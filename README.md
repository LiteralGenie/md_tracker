Userscript that tweaks MD's Recently Added page. Mostly aimed at filtering out already-read series.

-   Greys out manga that's already been added to library.
-   Greys out manga that have had at least N chapters read.
-   Greys out manga based on tags.
-   Add chapter list.
-   CSS tweaks
    -   Moves stats to below title (ratings, comment count, follow count)
    -   Series description is never truncated

Also adds support for syncing reading history between devices. But this requires running the [sync server](https://github.com/LiteralGenie/simple_kv) somewhere. Not recommended for reasons outlined in the link but it's an option.

Sample images: https://github.com/LiteralGenie/md_tracker/tree/master/readme_files

<img title="before-after" src="https://github.com/LiteralGenie/md_tracker/blob/master/readme_files/0_before_after.png" />

# Setup

- Install the [ViolentMonkey extension](https://violentmonkey.github.io/) (other userscript managers may work but untested).
- Add [md_tracker.user.js](https://github.com/LiteralGenie/md_tracker/releases/tag/latest) to ViolentMonkey.
- (optional) In the ViolentMonkey [menu](readme_files/menu_options.png), click the ["Edit Config" option](readme_files/config.png).

# Development

```bash
git clone https://github.com/LiteralGenie/md_tracker/
cd md_tracker
npm i
npm run dev

# then open http://localhost:6231/md_tracker.user.js in browser
# or manually copy-paste dist/md_tracker.user.js
```
