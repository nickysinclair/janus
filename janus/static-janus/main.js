/*
Janus: Jupyter Notebook extension that helps users keep clean notebooks by
hiding cells and tracking changes
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    '../janus/patch',
    '../janus/sidebar',
    '../janus/hide',
    '../janus/ui'
], function(
    require,
    $,
    Jupyter,
    events,
    JanusPatch,
    JanusSidebar,
    JanusHide,
    JanusUI
) {

    function loadCSS() {
        /* Load css for the extension */

        console.log('Loading CSS from main.css ...');

        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };


    function loadJanusPostNotebook() {
        /* run steps that require cells to already be loaded */

        console.log('Loading Janus ....');

        JanusPatch.initializeJanusMetadata();
        JanusUI.renderJanusUI();
        JanusHide.initializeVisibility();
        Jupyter.sidebar.updateHiddenCells();

        console.log('Janus loaded!');
    }


    function loadExtension() {
        /* Called as extension loads and notebook opens */

        loadCSS();
        JanusSidebar.createSidebar();
        JanusPatch.applyJanusPatches();

        // make sure notebook is fully loaded before interacting with it
        if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
            loadJanusPostNotebook();
        }
        events.on("notebook_loaded.Notebook", loadJanusPostNotebook);
    }


    // Tell Jupyter what to run when the extension loads
    return {
        load_jupyter_extension: loadExtension,
        load_ipython_extension: loadExtension
    };

});