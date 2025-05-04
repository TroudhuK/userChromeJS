// ==UserScript==
// @name           MultiRowTabLiteforFx.uc.js
// @namespace      http://space.geocities.yahoo.co.jp/gl/alice0775
// @description    Mehrzeilige Tableiste, Experimentelle CSS Version
// @include        main
// @compatibility  Firefox 138
// @author         Alice0775
// @version        2025/05/04 00:00 Firefox 138 TroudhuK
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
    gBrowser.tabContainer._dragTime = 0;
    gBrowser.tabContainer._elementIndex = 0;
    gBrowser.tabContainer._multiSelectedOffset = 0;
    gBrowser.tabContainer._dragIndex = 0;

    gBrowser.tabContainer.orig_isAnimatingMoveTogetherSelectedTabs = function() {
      for (let tab of gBrowser.selectedTabs) {
        if (tab._moveTogetherSelectedTabsData?.animate) {
          return true;
        }
      }
      return false;
    }

    gBrowser.tabContainer.orig_setMovingTabMode = function(movingTab) {
      this.toggleAttribute("movingtab", movingTab);
      gNavToolbox.toggleAttribute("movingtab", movingTab);
    }

    gBrowser.tabContainer.orig_getDragTarget = function(event, { ignoreSides = false } = {}) {
      let { target } = event;
      while (target) {
        if (isTab(target) || isTabGroupLabel(target)) {
          break;
        }
        target = target.parentNode;
      }
      if (target && ignoreSides) {
        let { width, height } = target.getBoundingClientRect();
        if (
          event.screenX < target.screenX + width * 0.25 ||
          event.screenX > target.screenX + width * 0.75 ||
          ((event.screenY < target.screenY + height * 0.25 ||
            event.screenY > target.screenY + height * 0.75) &&
            this.verticalMode)
        ) {
          return null;
        }
      }
      return target;
    }

    gBrowser.tabContainer.orig_getDropIndex = function(event, isLink) {
        let item = this.orig_getDragTarget(event);
        if (!item) {
            return this.ariaFocusableItems.length;
        }
        let isBeforeMiddle;

        let elementForSize = isTabGroupLabel(item) ? item.parentElement : item;
        if (this.verticalMode) {
            let middle =
                elementForSize.screenY +
                elementForSize.getBoundingClientRect().height / 2;
            isBeforeMiddle = event.screenY < middle;
        } else {
            let middle =
                elementForSize.screenX +
                elementForSize.getBoundingClientRect().width / 2;
            isBeforeMiddle = RTL_UI//this.#rtlMode
                ? event.screenX > middle
                : event.screenX < middle;
        }
        return item.elementIndex + (isBeforeMiddle ? 0 : 1);
    };
    
    

    // copy of the original and overrided getDropEffectForTabDrag method
    gBrowser.tabContainer.orig_getDropEffectForTabDrag = function(event) {
      var dt = event.dataTransfer;

      let isMovingTab = dt.mozItemCount > 0;
      for (let i = 0; i < dt.mozItemCount; i++) {
        // tabs are always added as the first type
        let types = dt.mozTypesAt(0);
        if (types[0] != TAB_DROP_TYPE) {
          isMovingTab = false;
          break;
        }
      }

      if (isMovingTab) {
        let sourceNode = dt.mozGetDataAt(TAB_DROP_TYPE, 0);
        if (
          (!!(isTab(sourceNode)) || !!(isTabGroupLabel(sourceNode))) &&
          sourceNode.ownerGlobal.isChromeWindow &&
          sourceNode.ownerDocument.documentElement.getAttribute("windowtype") ==
            "navigator:browser"
        ) {
          // Do not allow transfering a private tab to a non-private window
          // and vice versa.
          if (
            PrivateBrowsingUtils.isWindowPrivate(window) !=
            PrivateBrowsingUtils.isWindowPrivate(sourceNode.ownerGlobal)
          ) {
            return "none";
          }

          if (
            window.gMultiProcessBrowser !=
            sourceNode.ownerGlobal.gMultiProcessBrowser
          ) {
            return "none";
          }

          if (
            window.gFissionBrowser != sourceNode.ownerGlobal.gFissionBrowser
          ) {
            return "none";
          }

          return dt.dropEffect == "copy" ? "copy" : "move";
        }
      }

      if (Services.droppedLinkHandler.canDropLink(event, true)) {
        return "link";
      }
      return "none";
    }

    gBrowser.tabContainer.startTabDrag = function(event, tab, { fromTabList = false } = {}) {
      if (tab.multiselected) {
        for (let multiselectedTab of gBrowser.selectedTabs.filter(
          t => t.pinned != tab.pinned
        )) {
          gBrowser.removeFromMultiSelectedTabs(multiselectedTab);
        }
      }

      let dataTransferOrderedTabs;
      if (fromTabList || isTabGroupLabel(tab)) {
        // Dragging a group label or an item in the all tabs menu doesn't
        // change the currently selected tabs, and it's not possible to select
        // multiple tabs from the list, thus handle only the dragged tab in
        // this case.
        dataTransferOrderedTabs = [tab];
      } else {
        let selectedTabs = gBrowser.selectedTabs;
        let otherSelectedTabs = selectedTabs.filter(
          selectedTab => selectedTab != tab
        );
        dataTransferOrderedTabs = [tab].concat(otherSelectedTabs);
      }

      let dt = event.dataTransfer;
      for (let i = 0; i < dataTransferOrderedTabs.length; i++) {
        let dtTab = dataTransferOrderedTabs[i];
        dt.mozSetDataAt(TAB_DROP_TYPE, dtTab, i);
        if (isTab(dtTab)) {
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
      }

      // Set the cursor to an arrow during tab drags.
      dt.mozCursor = "default";

      // Set the tab as the source of the drag, which ensures we have a stable
      // node to deliver the `dragend` event.  See bug 1345473.
      dt.addElement(tab);

      let expandGroupOnDrop;
      if (!fromTabList && this.getDropEffectForTabDrag(event) == "move") {
        //this.#setMovingTabMode(true);
        this.toggleAttribute("movingtab", movingTab);
        gNavToolbox.toggleAttribute("movingtab", movingTab);

        if (tab.multiselected) {
          this._moveTogetherSelectedTabs(tab);
        } else if (isTabGroupLabel(tab) && !tab.group.collapsed) {
          this._lockTabSizing();
          //this.#keepTabSizeLocked = true;
          tab.group.collapsed = true;
          expandGroupOnDrop = true;
        }
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
      let browser = isTab(tab) && tab.linkedBrowser;
      if (isTabGroupLabel(tab)) {
        toDrag = document.getElementById("tab-drag-empty-feedback");
      } else if (gMultiProcessBrowser) {
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
        scrollPos:
          this.verticalMode && tab.pinned
            ? this.verticalPinnedTabsContainer.scrollTop
            : this.arrowScrollbox.scrollPosition,
        screenX: event.screenX,
        screenY: event.screenY,
        movingTabs: tab.multiselected ? gBrowser.selectedTabs : [tab],
        fromTabList,
        tabGroupCreationColor: gBrowser.tabGroupMenu.nextUnusedColor,
        expandGroupOnDrop,
      };

      event.stopPropagation();

      if (fromTabList) {
        Glean.browserUiInteraction.allTabsPanelDragstartTabEventCount.add(1);
      }

      this._elementIndex = tab.elementIndex;
    }

    gBrowser.tabContainer.getDropEffectForTabDrag = function(event){return "";}; // multirow fix: to make the default "dragover" handler does nothing

    gBrowser.tabContainer._onDragOver = function(event) {
      var effects = this.orig_getDropEffectForTabDrag(event);

      var ind = this._tabDropIndicator;
      if (effects == "" || effects == "none") {
        ind.hidden = true;
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      var arrowScrollbox = this.arrowScrollbox;

      // autoscroll the tab strip if we drag over the scroll
      // buttons, even if we aren't dragging a tab, but then
      // return to avoid drawing the drop indicator
      /*var pixelsToScroll = 0;
      if (this.overflowing) {
        switch (event.originalTarget) {
          case arrowScrollbox._scrollButtonUp:
            pixelsToScroll = arrowScrollbox.scrollIncrement * -1;
            break;
          case arrowScrollbox._scrollButtonDown:
            pixelsToScroll = arrowScrollbox.scrollIncrement;
            break;
        }
        if (pixelsToScroll) {
          arrowScrollbox.scrollByPixels(
            (RTL_UI ? -1 : 1) * pixelsToScroll,
            true
          );
        }
      }

      let draggedTab = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0);
      if (
        (effects == "move" || effects == "copy") &&
        document == draggedTab.ownerDocument &&
        !draggedTab._dragData.fromTabList
      ) {
        ind.hidden = true;

        if (this.orig_isAnimatingMoveTogetherSelectedTabs()) {
          // Wait for moving selected tabs together animation to finish.
          return;
        }
        this.finishMoveTogetherSelectedTabs(draggedTab);

        if (effects == "move") {
          this.orig_setMovingTabMode(true);

          // Pinned tabs in expanded vertical mode are on a grid format and require
          // different logic to drag and drop.
          /*if (this.#isContainerVerticalPinnedGrid(draggedTab)) {
            this.#animateExpandedPinnedTabMove(event);
            return;
          }* /
          this._animateTabMove(event);
          return;
        }
      }

      this.finishAnimateTabMove();*/

      if (effects == "link") {
        let target = this.orig_getDragTarget(event, { ignoreSides: true });
        if (target) {
          if (!this._dragTime) {
            this._dragTime = Date.now();
          }
          let overGroupLabel = isTabGroupLabel(target);
          if (
            !tab.hasAttribute("pending") && // annoying fix
            Date.now() >=
            this._dragTime +
              Services.prefs.getIntPref(
                overGroupLabel
                  ? "browser.tabs.dragDrop.expandGroup.delayMS"
                  : "browser.tabs.dragDrop.selectTab.delayMS"
              )
          ) {
            if (overGroupLabel) {
              target.group.collapsed = false;
            } else {
              this.selectedItem = target;
            }
          }
          if (isTab(target)) {
            // Dropping on the target tab would replace the loaded page rather
            // than opening a new tab, so hide the drop indicator.
            ind.hidden = true;
            return;
          }
        }
      }

      var rect = arrowScrollbox.getBoundingClientRect();
      var newMarginX, newMarginY;
      /*if (pixelsToScroll) {
        // if we are scrolling, put the drop indicator at the edge
        // so that it doesn't jump while scrolling
        let scrollRect = arrowScrollbox.scrollClientRect;
        let minMargin = this.verticalMode
          ? scrollRect.top - rect.top
          : scrollRect.left - rect.left;
        let maxMargin = this.verticalMode
          ? Math.min(minMargin + scrollRect.height, scrollRect.bottom)
          : Math.min(minMargin + scrollRect.width, scrollRect.right);
        if (RTL_UI) {
          [minMargin, maxMargin] = [
            this.clientWidth - maxMargin,
            this.clientWidth - minMargin,
          ];
        }
        newMarginX = pixelsToScroll > 0 ? maxMargin : minMargin;
      } else*/ {
        this._dragIndex = this.orig_getDropIndex(event);
        this._multiSelectedOffset = event.dataTransfer.mozGetDataAt(TAB_DROP_TYPE, 0)._dragData.movingTabs.filter(t => t.elementIndex < this._dragIndex).length;
        let children = this.ariaFocusableItems;
        if (this._dragIndex == children.length) {
          let itemRect = children.at(-1).getBoundingClientRect();
          if (this.verticalMode) {
            newMarginX = itemRect.bottom - rect.top;
          } else if (RTL_UI) {
            newMarginX = rect.right - itemRect.left;
          } else {
            newMarginX = itemRect.right - rect.left;
          }
          newMarginY = itemRect.top + itemRect.height - rect.top - rect.height + 6; // multirow fix
        } else {
          let itemRect = children[this._dragIndex].getBoundingClientRect();
          if (this.verticalMode) {
            newMarginX = rect.top - itemRect.bottom;
          } else if (RTL_UI) {
            newMarginX = rect.right - itemRect.right;
          } else {
            newMarginX = itemRect.left - rect.left;
          }
          newMarginY = itemRect.top + itemRect.height - rect.top - rect.height + 6; // multirow fix
        }
      }

      ind.hidden = false;
      newMarginX += this.verticalMode ? ind.clientHeight : ind.clientWidth / 2;
      if (RTL_UI) {
        newMarginX *= -1;
      }
      ind.style.transform = this.verticalMode
        ? "translateY(" + Math.round(newMarginX) + "px)"
        : "translate(" + Math.round(newMarginX) + "px," + Math.round(newMarginY) + "px)"; // multirow fix
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
            draggedTab.container.finishMoveTogetherSelectedTabs(draggedTab);
        }

        this._tabDropIndicator.hidden = true;

        var dropEffect = dt.dropEffect;
        if (draggedTab && dropEffect == "copy") {}
        else if (draggedTab && draggedTab.container == this) {
            this._dragIndex -= this._multiSelectedOffset;
            for (let tab of movingTabs) {
                gBrowser.moveTabTo(tab, { elementIndex: this._dragIndex });
                this._dragIndex++;
            }
        }

        this._dragIndex = 0;
    };
    gBrowser.tabContainer.addEventListener("drop", function(event){this.onDrop(event);}, false);
    
    gBrowser.tabContainer.onDragLeave = function(event) {
        this._dragTime = 0;
    }
    gBrowser.tabContainer.addEventListener("dragleave", function(event){this.onDragLeave(event);}, false);

    // override #moveTogetherSelectedTabs to fix it for multirow tabs
    gBrowser.tabContainer._moveTogetherSelectedTabs = function(tab) {
      let draggedTabIndex = tab.elementIndex;
      let selectedTabs = gBrowser.selectedTabs;
      if (selectedTabs.some(t => t.pinned != tab.pinned)) {
        throw new Error(
          "Cannot move together a mix of pinned and unpinned tabs."
        );
      }
      let animate = false;//!gReduceMotion;

      tab._moveTogetherSelectedTabsData = {
        finished: !animate,
      };

      let addAnimationData = (movingTab, isBeforeSelectedTab) => {
        let lowerIndex = Math.min(movingTab.elementIndex, draggedTabIndex) + 1;
        let higherIndex = Math.max(movingTab.elementIndex, draggedTabIndex);
        let middleItems = this.ariaFocusableItems
          .slice(lowerIndex, higherIndex)
          .filter(item => !item.multiselected);
        if (!middleItems.length) {
          // movingTab is already at the right position and thus doesn't need
          // to be animated.
          return;
        }

        movingTab._moveTogetherSelectedTabsData = {
          translatePos: 0,
          animate: true,
        };
        movingTab.toggleAttribute("multiselected-move-together", true);

        let postTransitionCleanup = () => {
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

        // Add animation data for tabs and tab group labels between movingTab
        // (multiselected tab moving towards the dragged tab) and draggedTab. Those items
        // in the middle should move in the opposite direction of movingTab.

        let movingTabSize =
          movingTab.getBoundingClientRect()[
            this.verticalMode ? "height" : "width"
          ];

        for (let middleItem of middleItems) {
          if (isTab(middleItem)) {
            if (middleItem.pinned != movingTab.pinned) {
              // Don't mix pinned and unpinned tabs
              break;
            }
            if (middleItem.multiselected) {
              // Skip because this multiselected tab should
              // be shifted towards the dragged Tab.
              continue;
            }
          }
          if (isTabGroupLabel(middleItem)) {
            // Shift the `.tab-group-label-container` to shift the label element.
            middleItem = middleItem.parentElement;
          }
          let middleItemSize =
            middleItem.getBoundingClientRect()[
              this.verticalMode ? "height" : "width"
            ];

          if (!middleItem._moveTogetherSelectedTabsData?.translatePos) {
            middleItem._moveTogetherSelectedTabsData = { translatePos: 0 };
          }
          movingTab._moveTogetherSelectedTabsData.translatePos +=
            isBeforeSelectedTab ? middleItemSize : -middleItemSize;
          middleItem._moveTogetherSelectedTabsData.translatePos =
            isBeforeSelectedTab ? -movingTabSize : movingTabSize;

          middleItem.toggleAttribute("multiselected-move-together", true);
        }
      };

      let tabIndex = selectedTabs.indexOf(tab);

      // Animate left or top selected tabs
      for (let i = 0; i < tabIndex; i++) {
        let movingTab = selectedTabs[i];
        if (animate) {
          addAnimationData(movingTab, true);
        } else {
          gBrowser.moveTabBefore(movingTab, tab);
        }
      }

      // Animate right or bottom selected tabs
      for (let i = selectedTabs.length - 1; i > tabIndex; i--) {
        let movingTab = selectedTabs[i];
        if (animate) {
          addAnimationData(movingTab, false);
        } else {
          gBrowser.moveTabAfter(movingTab, tab);
        }
      }

      // Slide the relevant tabs to their new position.
      for (let item of this.ariaFocusableItems) {
        if (isTabGroupLabel(item)) {
          // Shift the `.tab-group-label-container` to shift the label element.
          item = item.parentElement;
        }
        if (item._moveTogetherSelectedTabsData?.translatePos) {
          let translatePos =
            /*(this.#rtlMode ? -1 : 1) **/
            item._moveTogetherSelectedTabsData.translatePos;
          item.style.transform = `translate${
            /*this.verticalMode ? "Y" : */"X"
          }(${translatePos}px)`;
        }
      }
    }

    // copy of utility functions
    function isTab(element) {
      return !!(element?.tagName == "tab");
    }

    function isTabGroup(element) {
      return !!(element?.tagName == "tab-group");
    }

    function isTabGroupLabel(element) {
      return !!element?.classList?.contains("tab-group-label");
    }
}
