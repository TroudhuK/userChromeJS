// 'Alt click on tab discard it' script for Firefox by TroudhuK


var DiscardTabOnAltClickonTab = {
  init: function() {
    try {
      gBrowser.tabContainer.addEventListener('mousedown', function abc(e) {
        if (e.button==0 && e.altKey && e.target)
        {
          let aTab = e.target.closest("tab");
          if (aTab)
          {
            e.stopPropagation();
            e.preventDefault();

            gBrowser.discardBrowser(aTab);
          }
        }
      }, true);
    } catch(e) {}
  }
}

setTimeout(function(){
  DiscardTabOnAltClickonTab.init();
},500);
