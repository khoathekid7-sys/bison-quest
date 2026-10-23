# Reference photos

Put **real photos you took yourself** of each checkpoint here, one folder per gem:

```
public/references/carnegie/     ← Carnegie Building (gem 1)
public/references/elc-patio/    ← ELC uphill patio (gem 2)
```

Then list each file in `referenceImages` for that gem in `src/config/hunt.ts`
(see CONFIGURING.md, section 4).

Tips:

- 3–5 photos per checkpoint, taken from where players will stand.
- Mix angles, distances and lighting (morning, afternoon, dusk).
- Include what the photo instruction asks for (e.g. entrance + facade, or seating + building).
- Save as `.jpg`, any size. Publishing shrinks them to 1280 px automatically
  (`scripts/prepare-references.mjs`).
- Never use stock, AI-generated or unlicensed images. Players' photos are compared to these.

These folders are intentionally empty until you add photos. The app's
☰ → *Setup status* shows how many references each gem has.
