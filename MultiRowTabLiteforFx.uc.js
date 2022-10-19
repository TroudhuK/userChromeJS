// ==UserScript==
// @name           MultiRowTabLiteforFx.uc.js
// @namespace      http://space.geocities.yahoo.co.jp/gl/alice0775
// @description    Mehrzeilige Tableiste, Experimentelle CSS Version
// @include        main
// @compatibility  Firefox 73
// @author         Alice0775
// @version        2022/10/19 00:00 Firefox 106 TroudhuK
// @version        2020/02/14 00:00 Firefox 73 TroudhuK
// @version        2020/01/12 00:00 Firefox 72 TroudhuK
// @version        2019/09/14 00:00 Firefox 69 TroudhuK
// @version        2016/08/05 00:00 Firefox 48
// @version        2016/05/01 00:01 hide favicon if busy
// @version        2016/03/09 00:01 Bug 1222490 - Actually remove panorama for Fx45+
// @version        2016/02/09 00:01 workaround css for lwt
// @version        2016/02/09 00:00
// ==/UserScript==
    zzzz_MultiRowTabLite();
function zzzz_MultiRowTabLite() {
    gBrowser.tabContainer._getDropIndex = function(event, isLink) {
        var tabs = this.allTabs;
        var tab = this._getDragTargetTab(event, isLink);
        if (!RTL_UI) {
            for (let i = tab ? tab._tPos : 0; i < tabs.length; i++) {
                if (
                    event.screenY <
                    tabs[i].screenY + tabs[i].getBoundingClientRect().height
                ) {
                    if (
                        event.screenX <
                        tabs[i].screenX + tabs[i].getBoundingClientRect().width / 2
                    ) {
                        return i;
                    }
                    if (
                        event.screenX >
                        tabs[i].screenX + tabs[i].getBoundingClientRect().width / 2 &&
                        event.screenX <
                        tabs[i].screenX + tabs[i].getBoundingClientRect().width
                    ) {
                        return i + 1;
                    }
                }
            }
        } else {
            for (let i = tab ? tab._tPos : 0; i < tabs.length; i++) {
                if (
                    event.screenY <
                    tabs[i].screenY + tabs[i].getBoundingClientRect().height
                ) {
                    if (
                        event.screenX <
                        tabs[i].screenX + tabs[i].getBoundingClientRect().width &&
                        event.screenX >
                        tabs[i].screenX + tabs[i].getBoundingClientRect().width / 2
                    ) {
                        return i;
                    }
                    if (
                        event.screenX <
                        tabs[i].screenX + tabs[i].getBoundingClientRect().width / 2
                    ) {
                        return i + 1;
                    }
                }
            }
        }
        return tabs.length;
    };

    gBrowser.tabContainer.getDropEffectForTabDrag = function(event){return "";}; // multirow fix: to make the default "dragover" handler does nothing

    gBrowser.tabContainer._onDragOver = function(event) {
        event.preventDefault();
        event.stopPropagation();

        var ind = this._tabDropIndicator;

        var effects = orig_getDropEffectForTabDrag(event);
        if (effects == "link") {
        	let tab = this._getDragTargetTab(event, true);
        	if (tab) {
        		if (!this._dragTime)
        			this._dragTime = Date.now();
        		if (!tab.hasAttribute("pending") && // annoying fix
                    Date.now() >= this._dragTime + this._dragOverDelay)
        			this.selectedItem = tab;
        		ind.hidden = true;
        		return;
        	}
        }

        var newIndex = this._getDropIndex(event, effects == "link");
        if (newIndex == null)
            return;

        var rect = this.arrowScrollbox.getBoundingClientRect();
        var newMarginX, newMarginY;
        var tabs = this.allTabs;
        if (newIndex == tabs.length) {
            let tabRect = tabs[newIndex - 1].getBoundingClientRect();
            if (!RTL_UI)
                newMarginX = tabRect.right - rect.left;
            else
                newMarginX = rect.right - tabRect.left;
            newMarginY = tabRect.top + tabRect.height - rect.top - rect.height + 6; // multirow fix
        } else {
            let tabRect = tabs[newIndex].getBoundingClientRect();
            if (!RTL_UI)
                newMarginX = tabRect.left - rect.left;
            else
                newMarginX = rect.right - tabRect.right;
            newMarginY = tabRect.top + tabRect.height - rect.top - rect.height + 6; // multirow fix
        }

        ind.hidden = false;

        newMarginX += ind.clientWidth / 2;
        if (RTL_UI)
            newMarginX *= -1;

        ind.style.transform = "translate(" + Math.round(newMarginX) + "px," + Math.round(newMarginY) + "px)"; // multirow fix
    };
    gBrowser.tabContainer.addEventListener("dragover", gBrowser.tabContainer._onDragOver, false);

    gBrowser.tabContainer.onDrop = function(event) {
        var dt = event.dataTransfer;

        var draggedTab;
        let movingTabs;
        if (dt.mozTypesAt(0)[0] == TAB_DROP_TYPE) {
            // tab copy or move
            draggedTab = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
            // not our drop then
            if (!draggedTab)
                return;
            movingTabs = (draggedTab.multiselected ? gBrowser.selectedTabs : [draggedTab]).filter(t => t.pinned == draggedTab.pinned);
            draggedTab.container._finishGroupSelectedTabs(draggedTab);
        }
        var dropEffect = dt.dropEffect;
        if (draggedTab && dropEffect == "copy") {}
        else if (draggedTab && draggedTab.container == this) {
            let newIndex = this._getDropIndex(event, false);
            let incrementDropIndex = true;
            if (newIndex && newIndex > draggedTab._tPos) {
                newIndex--;
                incrementDropIndex = false;
            }
            for (let tab of movingTabs) {
                gBrowser.moveTabTo(tab, newIndex);
                if (incrementDropIndex) {
                    newIndex++;
                }
            }
        }
    };
    gBrowser.tabContainer.addEventListener("drop", function(event){this.onDrop(event);}, false);
}

// copy of the original and overrided getDropEffectForTabDrag method
function orig_getDropEffectForTabDrag(event) {
    var dt = event.dataTransfer;

    let isMovingTabs = dt.mozItemCount > 0;
    for (let i = 0; i < dt.mozItemCount; i++) {
        // tabs are always added as the first type
        let types = dt.mozTypesAt(0);
        if (types[0] != TAB_DROP_TYPE) {
            isMovingTabs = false;
            break;
        }
    }
    
    if (isMovingTabs) {
        let sourceNode = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
        if (XULElement.isInstance(sourceNode) &&
            sourceNode.localName == "tab" &&
            sourceNode.ownerGlobal.isChromeWindow &&
            sourceNode.ownerDocument.documentElement.getAttribute("windowtype") == "navigator:browser" &&
            sourceNode.ownerGlobal.gBrowser.tabContainer == sourceNode.container) {
            // Do not allow transfering a private tab to a non-private window
            // and vice versa.
            if (PrivateBrowsingUtils.isWindowPrivate(window) !=
                PrivateBrowsingUtils.isWindowPrivate(sourceNode.ownerGlobal))
                return "none";

            if (window.gMultiProcessBrowser !=
                sourceNode.ownerGlobal.gMultiProcessBrowser)
                return "none";

            if (window.gFissionBrowser != sourceNode.ownerGlobal.gFissionBrowser)
                return "none";

            return dt.dropEffect == "copy" ? "copy" : "move";
        }
    }

    if (browserDragAndDrop.canDropLink(event)) {
        return "link";
    }
    return "none";
}
