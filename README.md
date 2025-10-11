Userscript that tweaks MD's Recently Added page. Mostly aimed at filtering out already-read series.

-   Greys out manga that's already been added to library.
-   Greys out manga that have had at least N chapters read.
-   Greys out manga based on tags.
-   CSS tweaks
    -   Moves stats to below title (ratings, comment count, follow count)
    -   Series description is never truncated

Also adds support for syncing reading history between devices. But this requires running the [sync server](https://github.com/LiteralGenie/simple_kv) somewhere. Not recommended for reasons outlined in the link but it's an option.

Sample images:

# Setup

Install the [ViolentMonkey extension](https://violentmonkey.github.io/) (other userscript managers may work but no guarantees).

Download the [latest release]().

Add a new script to ViolentMonkey and copy paste the contents of the release.

(optional) In the ViolentMonkey [menu](readme_files/menu_options.png), click the ["Edit Config" option](readme_files/config.png).
