# Logo Grabber Bookmarklet

Logo Grabber is a browser bookmarklet that helps you find SVG logos on a webpage, preview the candidates visually, and upload the selected SVG directly to Cloudinary.

It is useful when a logo is embedded as an inline SVG, loaded as an SVG file, or referenced through an SVG symbol/sprite.

## What it does

- Scans the current webpage for SVG candidates.
- Shows a visual picker so you can choose the correct logo.
- Ranks likely logos near the top based on attributes such as `logo`, `brand`, `header`, and `nav`.
- Lets you download the selected SVG.
- Lets you upload the selected SVG to Cloudinary.
- Prompts each user once for their Cloudinary settings and stores them locally in their browser.

## Requirements

You need:

- A Cloudinary account.
- Your Cloudinary cloud name.
- An unsigned upload preset.
- A destination folder, for example `grabbed-logos`.

> Important: Use an unsigned upload preset only. Do not put an API secret in the bookmarklet or hosted JavaScript file.

## Installing the bookmarklet

1. Open the bookmarklet install page included in this repository.
2. Drag the **Logo Grabber** button to your browser bookmarks bar.
3. Visit any website where you want to grab a logo.
4. Click the **Logo Grabber** bookmarklet.

If your browser does not allow drag-and-drop bookmarklets, create a new bookmark manually and paste the bookmarklet code into the URL/location field.

## First-time setup

The first time you run the bookmarklet, it will ask for:

1. **Cloudinary cloud name**  
   Example: `demo`

2. **Unsigned upload preset**  
   This must be an unsigned preset configured in your Cloudinary account.

3. **Upload folder**  
   Example: `grabbed-logos`

These values are saved in your browser using `localStorage`, so you should only need to enter them once per browser/profile.

## Changing saved settings

Open the bookmarklet and click **Settings** in the Logo Grabber overlay. This clears your saved Cloudinary settings. Re-run the bookmarklet to enter new values.

## Using the picker

After running the bookmarklet, an overlay appears with all detected SVG candidates.

Each card shows:

- A visual preview of the SVG.
- The detected SVG type.
- The rendered size on the page.
- A small amount of related page metadata.

Available actions:

- **Download** saves or opens the SVG locally.
- **Upload** uploads the SVG to your configured Cloudinary account.
- After upload, the button changes to **Open ✓**, which opens the uploaded Cloudinary asset.

## Hosted script

The bookmarklet loads the script from:

```text
https://pglithro-cloudinary.github.io/logoGrabber/script.js
```

The bookmarklet adds a timestamp query string so the browser fetches the latest version each time:

```js
javascript:(()=>{let s=document.createElement('script');s.src='https://pglithro-cloudinary.github.io/logoGrabber/script.js?'+Date.now();document.body.append(s)})()
```

## Limitations

The bookmarklet can only access content available to JavaScript on the current page. It may not be able to detect logos that are:

- Inside closed shadow roots.
- Inside cross-origin iframes.
- Rendered to canvas.
- Loaded from external SVG URLs that block browser fetches using CORS rules.

Inline SVGs are the most reliable because the script can serialise them directly from the page.

## Security notes

- Do not include Cloudinary API secrets in this project.
- Use unsigned upload presets with appropriate restrictions.
- Consider limiting the upload preset by folder, allowed formats, tags, moderation, or other account policies as needed.
- The Cloudinary configuration is stored only in the user's browser via `localStorage`.

## Repository files

Suggested structure:

```text
logoGrabber/
├── README.md
├── index.html
└── script.js
```

- `README.md` explains how to install and use the bookmarklet.
- `index.html` provides a drag-and-drop installation page.
- `script.js` contains the Logo Grabber picker and upload logic.
