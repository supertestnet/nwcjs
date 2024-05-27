# nwcjs
A vanilla javascript library for working with Nostr Wallet Connect

## Use it like this

Note that nwc_info objects are also stored in nwcjs.nwc_objs so you can manage more than one NWC connection

```
var nwc_info = nwcjs.processNWCstring( "nostr+walletconnect://2fbe00e6698e717593febba15a68c37de13869b5c304cb8448fa3c541f8620c4?relay=wss://example.relay.com&secret=370d89b58cb4c38fccd4bba520fbbd9397f3682547b66b23a9a6888fef021038&lud16=example@lightning.com" );
```

## Make an invoice for 100 sats with description "hello world!"

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```
var amnt = 100;
var desc = "hello world!";
var delay_tolerance = 3;
var invoice_info = await nwcjs.makeInvoice( nwc_info, amnt, desc, delay_tolerance );
```

## Check an invoice's status

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```
var invoice = "lntb2500n1pwxlkl5pp5g8hz28tlf950ps942lu3dknfete8yax2ctywpwjs872x9kngvvuqdqage5hyum5yp6x2um5yp5kuan0d93k2cqzyskdc5s2ltgm9kklz42x3e4tggdd9lcep2s9t2yk54gnfxg48wxushayrt52zjmua43gdnxmuc5s0c8g29ja9vnxs6x3kxgsha07htcacpmdyl64";
var delay_tolerance = 3;
var invoice_info = await checkInvoice( nwc_obj, invoice, delay_tolerance );
```

## Check a payment's status

If there is an error, consider increasing your delay tolerance from 3 seconds to 5 or so

```
var invoice = "lntb2500n1pwxlkl5pp5g8hz28tlf950ps942lu3dknfete8yax2ctywpwjs872x9kngvvuqdqage5hyum5yp6x2um5yp5kuan0d93k2cqzyskdc5s2ltgm9kklz42x3e4tggdd9lcep2s9t2yk54gnfxg48wxushayrt52zjmua43gdnxmuc5s0c8g29ja9vnxs6x3kxgsha07htcacpmdyl64";
var delay_tolerance = 3;
var invoice_info = await didPaymentSucceed( nwc_obj, invoice, delay_tolerance );
```

## Pay an invoice

Originally this library had a method called nwcjs.payInvoice() instead of nwcjs.tryToPayInvoice(). After paying the invoice, it would return the invoice's preimage. I modified its name because (1) lightning payments do not reliably succeed, so I wanted to indicate that through the method name (2) lightning payments sometimes get stuck for several minutes or hours, and I prefer to avoid using the "await" command if it might get stuck for a long time. So I renamed payInvoice() to tryToPayInvoice() and made it so it never gets stuck, it just immediately sends the "pay" command to the server. But that doesn't mean the invoice will actually get paid, so I recommend following that up by calling the nwcjs.didPaymentSucceed() method to find out if the payment went through or not. In the meantime you can show your user a pending status indicator or similar.

If the invoice you're paying is amountless, add an amount to your payment by modifying the variable `var amnt`.

```
var invoice = "lntb2500n1pwxlkl5pp5g8hz28tlf950ps942lu3dknfete8yax2ctywpwjs872x9kngvvuqdqage5hyum5yp6x2um5yp5kuan0d93k2cqzyskdc5s2ltgm9kklz42x3e4tggdd9lcep2s9t2yk54gnfxg48wxushayrt52zjmua43gdnxmuc5s0c8g29ja9vnxs6x3kxgsha07htcacpmdyl64";
var amnt = null;
await nwcjs.tryToPayInvoice( nwc_info, invoice, amnt );
```
