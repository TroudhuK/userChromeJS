// ==UserScript==
// @name           MultiRowTabLiteforFx.uc.js
// @namespace      http://space.geocities.yahoo.co.jp/gl/alice0775
// @description    Mehrzeilige Tableiste, Experimentelle CSS Version
// @include        main
// @compatibility  Firefox 133
// @author         Alice0775
// @version        2024/12/14 00:00 Firefox 133 TroudhuK
// @version        2023/05/26 00:00 Firefox 112 TroudhuK
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
        var tab = this._getDragTargetTab(event, { ignoreTabSides: isLink });
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
    
    gBrowser.tabContainer.startTabDrag = function(event, tab, { fromTabList = false } = {}) {
      let dataTransferOrderedTabs;
      if (!fromTabList) {
        let selectedTabs = gBrowser.selectedTabs;
        let otherSelectedTabs = selectedTabs.filter(
          selectedTab => selectedTab != tab
        );
        dataTransferOrderedTabs = [tab].concat(otherSelectedTabs);
      } else {
        // Dragging an item in the tabs list doesn't change the currently
        // selected tabs, and it's not possible to select multiple tabs from
        // the list, thus handle only the dragged tab in this case.
        dataTransferOrderedTabs = [tab];
      }

      let dt = event.dataTransfer;
      for (let i = 0; i < dataTransferOrderedTabs.length; i++) {
        let dtTab = dataTransferOrderedTabs[i];

        dt.mozSetDataAt(TAB_DROP_TYPE, dtTab, i);
        let dtBrowser = dtTab.linkedBrowser;

        // We must not set text/x-moz-url or text/plain data here,
        // otherwise trying to detach the tab by dropping it on the desktop
        // may result in an "internet shortcut"
        dt.mozSetDataAt(
          "text/x-moz-text-internal",
          dtBrowser.currentURI.spec,
          i
        );
      }

      // Set the cursor to an arrow during tab drags.
      dt.mozCursor = "default";

      // Set the tab as the source of the drag, which ensures we have a stable
      // node to deliver the `dragend` event.  See bug 1345473.
      dt.addElement(tab);

      if (tab.multiselected) {
        _moveTogetherSelectedTabs(tab);
      }

      // Create a canvas to which we capture the current tab.
      // Until canvas is HiDPI-aware (bug 780362), we need to scale the desired
      // canvas size (in CSS pixels) to the window's backing resolution in order
      // to get a full-resolution drag image for use on HiDPI displays.
      let scale = window.devicePixelRatio;
      let canvas = this._dndCanvas;
      if (!canvas) {
        this._dndCanvas = canvas = document.createElementNS(
          "http://www.w3.org/1999/xhtml",
          "canvas"
        );
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.mozOpaque = true;
      }

      canvas.width = 160 * scale;
      canvas.height = 90 * scale;
      let toDrag = canvas;
      let dragImageOffset = -16;
      let browser = tab.linkedBrowser;
      if (gMultiProcessBrowser) {
        var context = canvas.getContext("2d");
        context.fillStyle = "white";
        context.fillRect(0, 0, canvas.width, canvas.height);

        let captureListener;
        let platform = AppConstants.platform;
        // On Windows and Mac we can update the drag image during a drag
        // using updateDragImage. On Linux, we can use a panel.
        if (platform == "win" || platform == "macosx") {
          captureListener = function () {
            dt.updateDragImage(canvas, dragImageOffset, dragImageOffset);
          };
        } else {
          // Create a panel to use it in setDragImage
          // which will tell xul to render a panel that follows
          // the pointer while a dnd session is on.
          if (!this._dndPanel) {
            this._dndCanvas = canvas;
            this._dndPanel = document.createXULElement("panel");
            this._dndPanel.className = "dragfeedback-tab";
            this._dndPanel.setAttribute("type", "drag");
            let wrapper = document.createElementNS(
              "http://www.w3.org/1999/xhtml",
              "div"
            );
            wrapper.style.width = "160px";
            wrapper.style.height = "90px";
            wrapper.appendChild(canvas);
            this._dndPanel.appendChild(wrapper);
            document.documentElement.appendChild(this._dndPanel);
          }
          toDrag = this._dndPanel;
        }
        // PageThumb is async with e10s but that's fine
        // since we can update the image during the dnd.
        PageThumbs.captureToCanvas(browser, canvas)
          .then(captureListener)
          .catch(e => console.error(e));
      } else {
        // For the non e10s case we can just use PageThumbs
        // sync, so let's use the canvas for setDragImage.
        PageThumbs.captureToCanvas(browser, canvas).catch(e =>
          console.error(e)
        );
        dragImageOffset = dragImageOffset * scale;
      }
      dt.setDragImage(toDrag, dragImageOffset, dragImageOffset);

      // _dragData.offsetX/Y give the coordinates that the mouse should be
      // positioned relative to the corner of the new window created upon
      // dragend such that the mouse appears to have the same position
      // relative to the corner of the dragged tab.
      let clientPos = ele => {
        const rect = ele.getBoundingClientRect();
        return this.verticalMode ? rect.top : rect.left;
      };

      let tabOffset = clientPos(tab) - clientPos(this);

      tab._dragData = {
        offsetX: this.verticalMode
          ? event.screenX - window.screenX
          : event.screenX - window.screenX - tabOffset,
        offsetY: this.verticalMode
          ? event.screenY - window.screenY - tabOffset
          : event.screenY - window.screenY,
        scrollPos: this.arrowScrollbox.scrollPosition,
        screenX: event.screenX,
        screenY: event.screenY,
        movingTabs: (tab.multiselected ? gBrowser.selectedTabs : [tab]).filter(
          t => t.pinned == tab.pinned
        ),
        fromTabList,
      };

      event.stopPropagation();

      if (fromTabList) {
        Glean.browserUiInteraction.allTabsPanelDragstartTabEventCount.add(1);
      }
    }

    gBrowser.tabContainer.getDropEffectForTabDrag = function(event){return "";}; // multirow fix: to make the default "dragover" handler does nothing

    gBrowser.tabContainer._onDragOver = function(event) {
        event.preventDefault();
        event.stopPropagation();

        var ind = this._tabDropIndicator;

        var effects = orig_getDropEffectForTabDrag(event);
        if (effects == "link") {
            let tab = this._getDragTargetTab(event, { ignoreTabSides: true });
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
            draggedTab.container._finishMoveTogetherSelectedTabs(draggedTab);
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

// override #moveTogetherSelectedTabs to fix it for multirow tabs
function _moveTogetherSelectedTabs(tab) {
  let draggedTabPos = tab._tPos;
  let selectedTabs = gBrowser.selectedTabs;
  let animate = false;//!gReduceMotion;

  tab._moveTogetherSelectedTabsData = {
    finished: !animate,
  };

  let addAnimationData = (
    movingTab,
    movingTabNewIndex,
    isBeforeSelectedTab = true
  ) => {
    let movingTabOldIndex = movingTab._tPos;

    if (movingTabOldIndex == movingTabNewIndex) {
      // movingTab is already at the right position
      // and thus don't need to be animated.
      return;
    }

    let movingTabSize =
      movingTab.getBoundingClientRect()[
        this.verticalMode ? "height" : "width"
      ];
    let shift = (movingTabNewIndex - movingTabOldIndex) * movingTabSize;

    movingTab._moveTogetherSelectedTabsData.animate = true;
    movingTab.toggleAttribute("multiselected-move-together", true);

    movingTab._moveTogetherSelectedTabsData.translatePos = shift;

    let postTransitionCleanup = () => {
      movingTab._moveTogetherSelectedTabsData.newIndex = movingTabNewIndex;
      movingTab._moveTogetherSelectedTabsData.animate = false;
    };
    if (gReduceMotion) {
      postTransitionCleanup();
    } else {
      let onTransitionEnd = transitionendEvent => {
        if (
          transitionendEvent.propertyName != "transform" ||
          transitionendEvent.originalTarget != movingTab
        ) {
          return;
        }
        movingTab.removeEventListener("transitionend", onTransitionEnd);
        postTransitionCleanup();
      };

      movingTab.addEventListener("transitionend", onTransitionEnd);
    }

    // Add animation data for tabs between movingTab (selected
    // tab moving towards the dragged tab) and draggedTab.
    // Those tabs in the middle should move in
    // the opposite direction of movingTab.

    let lowerIndex = Math.min(movingTabOldIndex, draggedTabPos);
    let higherIndex = Math.max(movingTabOldIndex, draggedTabPos);

    for (let i = lowerIndex + 1; i < higherIndex; i++) {
      let middleTab = gBrowser.visibleTabs[i];

      if (middleTab.pinned != movingTab.pinned) {
        // Don't mix pinned and unpinned tabs
        break;
      }

      if (middleTab.multiselected) {
        // Skip because this selected tab should
        // be shifted towards the dragged Tab.
        continue;
      }

      if (!middleTab._moveTogetherSelectedTabsData?.translatePos) {
        middleTab._moveTogetherSelectedTabsData = { translatePos: 0 };
      }
      if (isBeforeSelectedTab) {
        middleTab._moveTogetherSelectedTabsData.translatePos -=
          movingTabSize;
      } else {
        middleTab._moveTogetherSelectedTabsData.translatePos +=
          movingTabSize;
      }

      middleTab.toggleAttribute("multiselected-move-together", true);
    }
  };

  // Animate left or top selected tabs
  let insertAtPos = draggedTabPos - 1;
  for (let i = selectedTabs.indexOf(tab) - 1; i > -1; i--) {
    let movingTab = selectedTabs[i];
    insertAtPos = newIndex(movingTab, insertAtPos);

    if (animate) {
      movingTab._moveTogetherSelectedTabsData = {};
      addAnimationData(movingTab, insertAtPos, true);
    } else {
      gBrowser.moveTabTo(movingTab, insertAtPos);
    }
    insertAtPos--;
  }

  // Animate right or bottom selected tabs
  insertAtPos = draggedTabPos + 1;
  for (
    let i = selectedTabs.indexOf(tab) + 1;
    i < selectedTabs.length;
    i++
  ) {
    let movingTab = selectedTabs[i];
    insertAtPos = newIndex(movingTab, insertAtPos);

    if (animate) {
      movingTab._moveTogetherSelectedTabsData = {};
      addAnimationData(movingTab, insertAtPos, false);
    } else {
      gBrowser.moveTabTo(movingTab, insertAtPos);
    }
    insertAtPos++;
  }

  // Slide the relevant tabs to their new position.
  for (let t of gBrowser.tabContainer.visibleTabs) {
    if (t._moveTogetherSelectedTabsData?.translatePos) {
      let translatePos =
        /*(this.#rtlMode ? -1 : 1) **/
        t._moveTogetherSelectedTabsData.translatePos;
      t.style.transform = `translate${
        /*this.verticalMode ? "Y" : */"X"
      }(${translatePos}px)`;
    }
  }

  function newIndex(aTab, index) {
    // Don't allow mixing pinned and unpinned tabs.
    if (aTab.pinned) {
      return Math.min(index, gBrowser.pinnedTabCount - 1);
    }
    return Math.max(index, gBrowser.pinnedTabCount);
  }
}
