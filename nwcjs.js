// dependencies: browserify-cipher and noble-secp256k1
// https://bundle.run/browserify-cipher@1.0.1
// https://bundle.run/noble-secp256k1@1.2.14
var nwcjs = {
    nwc_objs: [],
    response: null,
    hexToBytes: hex => Uint8Array.from( hex.match( /.{1,2}/g ).map( byte => parseInt( byte, 16 ) ) ),
    bytesToHex: bytes => bytes.reduce( ( str, byte ) => str + byte.toString( 16 ).padStart( 2, "0" ), "" ),
    base64ToHex: str => {
        var raw = atob( str );
        var result = '';
        var i; for ( i=0; i<raw.length; i++ ) {
            var hex = raw.charCodeAt( i ).toString( 16 );
            result += hex.length % 2 ? '0' + hex : hex;
        }
        return result.toLowerCase();
    },
    sha256: async text_or_bytes => {
        if ( typeof text_or_bytes === "string" ) text_or_bytes = ( new TextEncoder().encode( text_or_bytes ) );
        var hash = await nobleSecp256k1.utils.sha256( text_or_bytes );
        return nwcjs.bytesToHex( hash );
    },
    processNWCstring: string => {
        if ( !string.startsWith( "nostr+walletconnect://" ) ) return alert( `Your pairing string was invalid, try one that starts with this: nostr+walletconnect://` );
        string = string.substring( 22 );
        var arr = string.split( "&" );
        arr.splice( 0, 1, ...arr[ 0 ].split( "?" ) );
        arr[ 0 ] = "wallet_pubkey=" + arr[ 0 ];
        var arr2 = [];
        var obj = {}
        arr.forEach( item => arr2.push( ...item.split( "=" ) ) );
        arr2.forEach( ( item, index ) => {if ( item === "secret" ) arr2[ index ] = "app_privkey";});
        arr2.forEach( ( item, index ) => {if ( index % 2 ) {obj[ arr2[ index - 1 ] ] = item;}});
        obj[ "app_pubkey" ] = nobleSecp256k1.getPublicKey( obj[ "app_privkey" ], true ).substring( 2 );
        nwcjs.nwc_objs.push( obj );
        return true;
    },
    getSignedEvent: async ( event, privateKey ) => {
        var eventData = JSON.stringify([
            0,
            event['pubkey'],
            event['created_at'],
            event['kind'],
            event['tags'],
            event['content']
        ]);
        event.id  = await nwcjs.sha256( ( new TextEncoder().encode( eventData ) ) );
        event.sig = await nobleSecp256k1.schnorr.sign( event.id, privateKey );
        return event;
    },
    sendEvent: ( event, relay ) => {
        var socket = new WebSocket( relay );
        socket.addEventListener( 'open', async () => {
            socket.send( JSON.stringify( [ "EVENT", event ] ) );
            setTimeout( () => {socket.close();}, 1000 );
        });
        return event.id;
    },
    getEvents: async ( relay, kinds, until, since, limit, etags, ptags, seconds_of_delay_tolerable ) => {
        var socket = new WebSocket( relay );
        var events = [];
        socket.addEventListener( 'message', async function( message ) {
            var [ type, subId, event ] = JSON.parse( message.data );
            var { kind, content } = event || {}
            if ( !event || event === true ) return;
            events.push( event );
        });
        socket.addEventListener( 'open', async function( e ) {
            var subId   = nwcjs.bytesToHex( nobleSecp256k1.utils.randomPrivateKey() ).substring( 0, 16 );
            var filter  = {}
            if ( kinds ) filter.kinds = kinds;
            if ( until ) filter.until = until;
            if ( since ) filter.since = since;
            if ( limit ) filter.limit = limit;
            if ( etags ) filter[ "#e" ] = etags;
            if ( ptags ) filter[ "#p" ] = ptags;
            var subscription = [ "REQ", subId, filter ];
            socket.send( JSON.stringify( subscription ) );
        });
        var num_of_seconds_waited = 0;
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            num_of_seconds_waited = num_of_seconds_waited + 1;
            var time_is_up = num_of_seconds_waited >= seconds_of_delay_tolerable;
            console.log( `num_of_seconds_waited:`, num_of_seconds_waited, `out of`, seconds_of_delay_tolerable );
            if ( time_is_up ) {
                socket.close();
                return events;
            }
            if ( events.length > 0 ) {
                socket.close();
                return events;
            }
            if ( !time_is_up ) return await loop();
        }
        return await loop();
    },
    getResponse: async ( nwc_obj, event_id, seconds_of_delay_tolerable = 3 ) => {
        nwcjs.response = null;
        var relay = nwc_obj[ "relay" ];
        var kinds = [ 23195 ];
        var until = null;
        var since = null;
        var limit = 1;
        var etags = [ event_id ];
        var ptags = [ nwc_obj[ "app_pubkey" ] ];
        var events = await nwcjs.getEvents( relay, kinds, until, since, limit, etags, ptags, seconds_of_delay_tolerable );
        var dmsg = nwcjs.decrypt( nwc_obj[ "app_privkey" ], events[ 0 ].pubkey, events[ 0 ].content );
        nwcjs.response = JSON.parse( dmsg );
    },
    makeInvoice: async ( nwc_obj, amt, desc, seconds_of_delay_tolerable = 3 ) => {
        var msg = JSON.stringify({
            method: "make_invoice",
            params: {
                amount: amt * 1000,
                description: desc,
            }
        });
        var emsg = nwcjs.encrypt( nwc_obj[ "app_privkey" ], nwc_obj[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_obj[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_obj[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_obj[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_obj, id, seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_obj[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response ) return await loop();
            return nwcjs.response;
        }
        return await loop();
    },
    checkInvoice: async ( nwc_obj, invoice, seconds_of_delay_tolerable = 3 ) => {
        var msg = JSON.stringify({
            method: "lookup_invoice",
            params: {
                invoice,
            }
        });
        var emsg = nwcjs.encrypt( nwc_obj[ "app_privkey" ], nwc_obj[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_obj[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_obj[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_obj[ "app_privkey" ] );
        var id = event.id;
        nwcjs.getResponse( nwc_obj, id, seconds_of_delay_tolerable );
        await nwcjs.waitSomeSeconds( 1 );
        var relay = nwc_obj[ "relay" ];
        nwcjs.sendEvent( event, relay );
        var loop = async () => {
            await nwcjs.waitSomeSeconds( 1 );
            if ( !nwcjs.response ) return await loop();
            return nwcjs.response;
        }
        return await loop();
        // an error looks like this:
        // {error: {code: "INTERNAL", message: "Something went wrong while looking up invoice: "}, result_type: "lookup_invoice"}
    },
    tryToPayInvoice: async ( nwc_obj, invoice, amnt, seconds_of_delay_tolerable = 30 ) => {
        var msg = {
            method: "pay_invoice",
            params: {
                invoice,
            }
        }
        if ( amnt ) msg[ "params" ][ "amount" ] = amnt;
        msg = JSON.stringify( msg );
        var emsg = nwcjs.encrypt( nwc_obj[ "app_privkey" ], nwc_obj[ "wallet_pubkey" ], msg );
        var obj = {
            kind: 23194,
            content: emsg,
            tags: [ [ "p", nwc_obj[ "wallet_pubkey" ] ] ],
            created_at: Math.floor( Date.now() / 1000 ),
            pubkey: nwc_obj[ "app_pubkey" ],
        }
        var event = await nwcjs.getSignedEvent( obj, nwc_obj[ "app_privkey" ] );
        var id = event.id;
        var relay = nwc_obj[ "relay" ];
        nwcjs.sendEvent( event, relay );
    },
    encrypt: ( privkey, pubkey, text ) => {
        var key = nobleSecp256k1.getSharedSecret( privkey, '02' + pubkey, true ).substring( 2 );
        var iv = window.crypto.getRandomValues( new Uint8Array( 16 ) );
        var cipher = browserifyCipher.createCipheriv( 'aes-256-cbc', nwcjs.hexToBytes( key ), iv );
        var encryptedMessage = cipher.update(text,"utf8","base64");
        emsg = encryptedMessage + cipher.final( "base64" );
        var uint8View = new Uint8Array( iv.buffer );
        var decoder = new TextDecoder();
        return emsg + "?iv=" + btoa( String.fromCharCode.apply( null, uint8View ) );
    },
    decrypt: ( privkey, pubkey, ciphertext ) => {
        var [ emsg, iv ] = ciphertext.split( "?iv=" );
        var key = nobleSecp256k1.getSharedSecret( privkey, '02' + pubkey, true ).substring( 2 );
        var decipher = browserifyCipher.createDecipheriv(
            'aes-256-cbc',
            nwcjs.hexToBytes( key ),
            nwcjs.hexToBytes( nwcjs.base64ToHex( iv ) )
        );
        var decryptedMessage = decipher.update( emsg, "base64" );
        dmsg = decryptedMessage + decipher.final( "utf8" );
        return dmsg;
    },
    waitSomeSeconds: num => {
        var num = num.toString() + "000";
        num = Number( num );
        return new Promise( resolve => setTimeout( resolve, num ) );
    },
}
