// ==UserScript==
// @name            MCPasteAndGo.uc.js
// @description     Inhalt der Zwischenablage mit einem Mittelklick oder Umschalttaste + Linksklick 
// @description2    in eine Suchleiste einfügen, Suche startet automatisch.
// @version         2.0
// @author          y2k
// @contributor	    aborix
// @namespace       http://tabunfirefox.web.fc2.com/
// @note            Mittelklick oder Umschalttaste + Linksklick
// @note            Anpassung für Firefox 54 und e10s Kompatibilität
// ==/UserScript==

(function() {
    if (location != "chrome://browser/content/browser.xhtml")
        return;
    
    var newTabButton = gBrowser.tabContainer.newTabButton;
    if (newTabButton) {
        newTabButton.onclick = function () {};
        newTabButton.addEventListener(
            'click',
            function (event) {
                if (event.button != 1)
                    return;

                let clipboard = readFromClipboard();
                if (!clipboard)
                    return;

                // Strip embedded newlines and surrounding whitespace, to match the URL
                // bar's behavior (stripsurroundingwhitespace)
                clipboard = clipboard.replace(/\s*\n\s*/g, "");

                clipboard = UrlbarUtils.stripUnsafeProtocolOnPaste(clipboard);

                gBrowser.loadOneTab(clipboard, {
                    triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
                    inBackground: false,
                    allowThirdPartyFixup: true,
                });
                event.preventDefault();
                event.stopPropagation();
            },
            false
        );
    }
})();
