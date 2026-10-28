# Heirloom Studio: start here

This is the full source for your charm shop website and its charm builder. **Heirloom Studio** is the store name. Its brand settings are in `dist/js/config.js`.

## What you have

- **A website** with a charm builder: pick a clasp first, then a tomato personality. Dust plugs automatically pair with a Small tomato; phone loops, key rings and lobster clasps pair with Regular. String 1 to 3 strands, with up to 3 beads per strand for dust plugs and 5 for other clasps. It shows the price as you build, has undo/redo, a "Surprise me" button, share links, and a shopping bag.
- **A predesigned ideas page** at `dist/ideas.html`. The home page shows three featured ideas; the dedicated page automatically shows every product in `dist/js/catalog.js`, so add future ideas there and they will appear in the full collection.
- **A checkout helper** (the `server/` folder). It is a small program that decides the real price and creates the Shopify checkout, so nobody can change a price from their browser.
- Automated tests check the builder, the prices and the checkout helper.

## What it does not do yet

- **It cannot take real payments.** The site ships in preview mode: placeholder prices, checkout switched off. This is on purpose.
- **The checkout helper has never been connected to a real Shopify shop.** It was only tested against a pretend one. `SHOPIFY_SETUP.md` section 5 lists the 12 things a test shop must confirm before you sell anything.
- No real product photos or finalized brand assets, reviews, shipping or return policy, or business email yet. Nothing was made up for these; the page says they are coming.

## See it on your computer

You need Python 3 (already on most computers). In a terminal, inside this folder:

```
python3 -m http.server 3000 --directory dist
```

Then open http://localhost:3000. To run the tests you also need Node 20 or newer, then `npm test`.

## Accounts you should own yourself

Everything real should be in your name, not anyone else's: your **Shopify** store, a **Shopify Dev Dashboard app** for the checkout helper, a **Cloudflare** account to run it, a **domain name**, and somewhere to host the `dist` folder. Prices and plan limits change, so check each provider's current page before you sign up. Nothing has been bought or set up for you.

## Order of work

1. **Decide the things only you can** (list below).
2. Create a Shopify **test/development store** and add one product variant for each item listed by the command in `server/README.md`.
3. Follow `server/README.md` to put the checkout helper on Cloudflare, then switch on `SHOP.api` in `dist/js/config.js`.
4. Work through `SHOPIFY_SETUP.md` section 5 and place a **test-mode order**. Do not go live until all of it passes.
5. Replace the placeholder words, prices and pictures, then publish `dist`.

## Decisions only you can make

Nothing below is written on the site, because nobody can guess it for you.

- How long a made-to-order charm takes to ship, and your return rule for custom items.
- What the clasps and rings are made of (nickel-free?), and what the beads are made of.
- The actual dimensions and weight of each tomato size, beads, key rings, clasps, phone loops, and dust plugs. Until the artist provides them, the storefront explicitly marks those measurements as unconfirmed.
- Where you will buy the USB-C and Lightning dust plugs, and what they cost. Whether they fit is not confirmed.
- Where you ship, and what shipping costs.
- Whether you want a gift note, or a choice between "make it exactly as shown" and "maker may adjust the bead order".
- Your brand name, wording, photos and contact email.

## Make it yours

- **Name, tagline, wording at the top and bottom:** `dist/js/config.js`, section `brand` (also the matching words in `dist/index.html`).
- **Your email:** `email` in `dist/js/config.js`. The contact link stays off until you set it.
- **Prices, colors, tomato faces, bead shapes:** `dist/js/catalog.js`. Prices are in cents (800 = $8.00). In a live shop the real prices come from Shopify.
- **Tomato pricing:** `TOMATO_SIZES` sets the base price for each size, and each expression in `TOMATOES` has its own add-on price. `CLASPS` determines the size automatically. All are placeholders until finalized.
- **Page text:** `dist/index.html`. **Look and feel:** `dist/styles.css`.

## Files worth knowing

`README.md` (overview and file map) · `SHOPIFY_SETUP.md` (Shopify steps and the launch checklist) · `server/README.md` (the checkout helper) · `QA_REPORT.md` (what was checked, and what was not) · `CLAUDE_HANDOFF.md` (a progress log and next steps; hand it to an AI coding assistant or a developer along with the README if you want help continuing) · `research/` (why the checkout is built this way, and notes on other charm builders).

## Honest status

Built and tested on a computer only. Not yet tried on a real iPhone or Android phone, with a screen reader, or against a real Shopify store. Treat it as a strong starting point, not a finished shop.
