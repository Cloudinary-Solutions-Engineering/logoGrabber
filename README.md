# Logo Grabber

Logo Grabber is a bookmarklet-powered tool for finding SVG logos on the current web page, previewing them visually, downloading them, or uploading them directly to Cloudinary.

It is designed for quickly capturing inline SVG logos and SVG logo files from websites.

## Features

- Finds inline `<svg>` elements on the current page.
- Finds SVG files used in `<img>`, `<object>`, and `<embed>` elements.
- Finds SVGs referenced through `<use>` and SVG sprite patterns where accessible.
- Searches inside open shadow DOM roots.
- Displays all SVG candidates in a visual picker.
- Sorts candidates by rendered pixel area, largest first.
- Downloads the selected SVG.
- Uploads the selected SVG to Cloudinary using an unsigned upload preset.
- Stores each user’s Cloudinary cloud name and upload preset locally in their browser.
- Names downloaded and uploaded assets using the root domain of the current website.

## How it works

When the bookmarklet is run on a web page, the script scans the page for SVG candidates and opens a picker overlay.

Each candidate shows:

- a visual preview
- the detected SVG type
- its rendered width and height
- any useful surrounding metadata, such as class names, IDs, alt text, title text, or ARIA labels

The largest SVGs are shown first. This helps push small icons and site furniture lower in the list.

## Asset naming

Downloaded and uploaded assets are named using the root domain of the website plus `_logo`.

For example:

| Website | Asset name |
|---|---|
| `https://www.example.com` | `example.com_logo.svg` |
| `https://shop.example.co.uk` | `example.co.uk_logo.svg` |
| `https://www.cloudinary.com` | `cloudinary.com_logo.svg` |

For Cloudinary uploads, the script sends the same value as the `public_id`, without the `.svg` extension.

Example:

```text
example.com_logo
```

## Cloudinary configuration

The first time a user runs the bookmarklet, they are prompted for:

1. Cloudinary cloud name
2. Cloudinary unsigned upload preset

These values are saved in the browser using `localStorage`, so the user only needs to enter them once.

The script does not ask for or send a separate upload folder/path value. Any destination folder, naming mode, upload restrictions, transformations, moderation, or other upload behaviour should be configured in the Cloudinary upload preset.

## Important security note

Use an unsigned upload preset.

Do not put an API key, API secret, or signed upload credentials in this script. Bookmarklet code runs in the browser and can be inspected by users or by pages where it is executed.

## Installation

Host the script somewhere publicly accessible, for example GitHub Pages.

Then create a bookmark with this URL:

```javascript
javascript:(()=>{let s=document.createElement('script');s.src='https://YOUR_USERNAME.github.io/YOUR_REPO/script.js?'+Date.now();document.body.append(s)})()
```

Replace the URL with the location of your hosted `script.js`.

The `Date.now()` query string prevents the browser from using a stale cached copy of the script while you are updating it.

## Usage

1. Visit a website whose SVG logo you want to capture.
2. Click the Logo Grabber bookmarklet.
3. Enter your Cloudinary cloud name and unsigned upload preset if prompted.
4. Review the SVG candidates in the picker.
5. Choose either:
   - **Download** to save the SVG locally.
   - **Upload** to upload the SVG to Cloudinary.
6. After a successful upload, the Upload button changes to **Open ✓** and opens the uploaded Cloudinary asset.

## Changing saved settings

Click **Settings** in the picker to clear the saved Cloudinary configuration.

After clearing settings, re-run the bookmarklet and enter the new cloud name and unsigned upload preset.

## Limitations

Logo Grabber can only access content available to the page’s JavaScript context.

It may not be able to capture:

- SVGs inside closed shadow DOM roots
- SVGs inside cross-origin iframes
- logos rendered to canvas
- external SVG files blocked by CORS when attempting upload
- CSS background images that reference SVGs

Inline SVGs are generally the most reliable candidates because the script can serialise them directly from the DOM.

## Recommended Cloudinary upload preset setup

Create an unsigned upload preset in Cloudinary and configure your preferred behaviour there.

Common preset settings include:

- allowed formats
- target asset folder/path
- overwrite behaviour
- tags or metadata rules
- moderation or approval workflows
- incoming transformations

The script sends:

- `file`
- `upload_preset`
- `public_id`
- `tags`

It does not send a separate folder value.

## Troubleshooting

### No SVGs found

The page may not use SVG logos, or the logo may be rendered as a raster image, CSS background, canvas element, closed shadow DOM element, or inside a cross-origin iframe.

### Upload failed

Possible causes include:

- the upload preset is not unsigned
- the upload preset does not allow SVG files
- the cloud name is incorrect
- the external SVG is blocked by CORS
- the preset has restrictions that reject the upload

### The wrong SVG appears first

The picker sorts by rendered pixel area, largest first. Some pages may contain large decorative SVGs or illustrations. In that case, visually choose the correct logo from the picker.

## Files

A typical repository contains:

```text
script.js
README.md
index.html
```

`script.js` contains the bookmarklet logic.

`index.html` can be used as a simple installation page with a draggable bookmarklet link.

`README.md` explains setup and usage.
