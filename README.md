# nwcjs
A vanilla javascript library for working with Nostr Wallet Connect and zaps

## Use it like this

Note that nwc_info objects are also stored in nwcjs.nwc_objs so you can manage more than one NWC connection

```javascript
var nwc_info = nwcjs.processNWCstring( "nostr+walletconnect://2fbe00e6698e717593febba15a68c37de13869b5c304cb8448fa3c541f8620c4?relay=wss://example.relay.com&secret=370d89b58cb4c38fccd4bba520fbbd9397f3682547b66b23a9a6888fef021038&lud16=example@lightning.com" );
```

## Get info

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```javascript
var delay_tolerance = 3;
var wallet_info = await nwcjs.getInfo( nwc_info, delay_tolerance );
```

## Make an invoice for 100 sats with description "hello world!"

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```javascript
var amnt = 100;
var desc = "hello world!";
var delay_tolerance = 3;
var invoice_info = await nwcjs.makeInvoice( nwc_info, amnt, desc, delay_tolerance );
```

## Check an invoice's status

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```javascript
var invoice = "lntb2500n1pwxlkl5pp5g8hz28tlf950ps942lu3dknfete8yax2ctywpwjs872x9kngvvuqdqage5hyum5yp6x2um5yp5kuan0d93k2cqzyskdc5s2ltgm9kklz42x3e4tggdd9lcep2s9t2yk54gnfxg48wxushayrt52zjmua43gdnxmuc5s0c8g29ja9vnxs6x3kxgsha07htcacpmdyl64";
var delay_tolerance = 3;
var invoice_info = await nwcjs.checkInvoice( nwc_info, invoice, delay_tolerance );
```

## Check your balance

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```javascript
var delay_tolerance = 3;
var balance_info = await nwcjs.getBalance( nwc_info, delay_tolerance );
```

## List transactions

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```javascript
var from = 1723625720; //optional. If you include "from" then no tx created before the specified timestamp will be returned
var until = 1723680682; //optional. If you include "until" then no tx created after the specified timestamp will be returned
var limit = 10; //optional. If you include "limit" then a number of txs equal to or smaller than your limit will be returned
var offset = 2; //optional. If you include "offset" then the first n txs which *would* have been returned will be skipped (where n == offset) and, if possible, other transactions that match your other filters will be added onto the end til you reach (1) the limit you set (2) whatever limit the wallet defaults to, if any (3) or until no more transactions match your other filters
var unpaid = true; //optional and defaults to false. Unless you set it to true, any txs that haven't been settled yet will be skipped
var type = "incoming"; //optional and defaults to null. You can set it to "incoming" to only return txs that paid you or set it to "outgoing" to only return txs where you paid someone. Keeping it null (or not including it at all) means you will get all transactions, incoming *and* outgoing.
var delay_tolerance = 3;
var txs = await nwcjs.listTransactions ( nwc_info, from, until, limit, offset, unpaid, type, delay_tolerance );
```

## Check a payment's status

This method will return false if a payment did not succeed yet. If the payment did succeed, it will return the invoice preimage.

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```javascript
var invoice = "lntb2500n1pwxlkl5pp5g8hz28tlf950ps942lu3dknfete8yax2ctywpwjs872x9kngvvuqdqage5hyum5yp6x2um5yp5kuan0d93k2cqzyskdc5s2ltgm9kklz42x3e4tggdd9lcep2s9t2yk54gnfxg48wxushayrt52zjmua43gdnxmuc5s0c8g29ja9vnxs6x3kxgsha07htcacpmdyl64";
var delay_tolerance = 3;
var invoice_info = await nwcjs.didPaymentSucceed( nwc_info, invoice, delay_tolerance );
```

## Pay an invoice

Originally this library had a method called nwcjs.payInvoice() instead of nwcjs.tryToPayInvoice(). After paying the invoice, it would return the invoice's preimage. I modified its name because (1) lightning payments do not reliably succeed, so I wanted to indicate that through the method name (2) lightning payments sometimes get stuck for several minutes or hours, and I prefer to avoid using the "await" command if it might get stuck for a long time. So I renamed payInvoice() to tryToPayInvoice() and made it so it never gets stuck, it just immediately sends the "pay" command to the wallet. But that doesn't mean the invoice will actually get paid, so I recommend following that up by calling the nwcjs.didPaymentSucceed() method to find out if the payment went through or not. In the meantime you can show your user a pending status indicator or similar.

If the invoice you're paying is amountless, add an amount to your payment by modifying the variable `var amnt`.

```javascript
var invoice = "lntb2500n1pwxlkl5pp5g8hz28tlf950ps942lu3dknfete8yax2ctywpwjs872x9kngvvuqdqage5hyum5yp6x2um5yp5kuan0d93k2cqzyskdc5s2ltgm9kklz42x3e4tggdd9lcep2s9t2yk54gnfxg48wxushayrt52zjmua43gdnxmuc5s0c8g29ja9vnxs6x3kxgsha07htcacpmdyl64";
var amnt = null;
await nwcjs.tryToPayInvoice( nwc_info, invoice, amnt );
```

## Make a zap request

This method takes a lightning address and amount of sats as input and returns a lightning invoice and a checking id. You can also optionally specify a list of one or more relays where you want the recipient of the funds to send their zap receipt to. By default, it requests all receipts to be sent to just one relay, nostrue.com.

```javascript
var lnaddy = "supertestnet@stacker.news";
var amount = 500;
var relays = ["wss://nostrue.com"];
var [ invoice, checking_id ] = await nwcjs.getZapRequest( lnaddy, amount, relays );
```

## Check the status of a zap

This method takes a lightning invoice and checking id as input and returns either the string "not paid yet" or the zap receipt provided by the recipient of the funds. You can also specify a list of one or more relays where you expect the recipient of the funds to send their zap receipt to. By default, it listens for all zap receipts on just one relay, nostrue.com.

```javascript
var invoice = "lnbc5u1pn9702rpp5f4llv47d5twpzyguv2ja7dmterschk5ee33e25qhgmc3vr9ttdgqdpuge6kuerfdenjqsrnw4cx2un5v4ehgmn9wssx7m3qwd6xzcmtv4ezumn9waescqzzsxqrrsssp5ss0vw8je6jclg2yzvjxwf5u94ay9dzj0ef40jv6m668247553d9q9qyyssqv7ehg6mal8y8ldhq2aflhmetdhghkxw0xndtprls85qeuve57cxzaaty9zllk7c2c4hn99azsnkc9hr44zvzzq36rcpapgyv4qcw7pspt5yct5";
var checking_id = "412e821f8f821402dc9e8e8ce1f1e8203beba95a52807e8102c40d1a42130858";
var relays = ["wss://nostrue.com"];
var status = await nwcjs.checkZapStatus( invoice, checking_id, relays );
```
