/*
Janus: Jupyter Notebook Extension that assist with notebook cleaning
*/

define([
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    'base/js/utils',
    'notebook/js/cell',
    'notebook/js/codecell',
    'notebook/js/textcell',
    '../janus/patch'
], function(
    require,
    $,
    Jupyter,
    events,
    utils,
    Cell,
    CodeCell,
    TextCell,
    JanusPatch
){

    //TODO fix bug with page scrolling to last selected cell, even when sidebar opened
    // ideally, find what causes it to jump to the selected cell...
    //TODO separate code into multiple files for future maintenance
    //TODO enable cell-level histories
    //TODO show full history of all cell executions
    //TODO enable meta-data only notebook history tracking (stretch)
    //TODO render more informative marker of hidden cells (stretch)

    var Sidebar = function(nb){
        /* A sidebar panel for indenting cells */

        var sidebar = this;
        Jupyter.sidebar = sidebar;

        sidebar.notebook = nb;
        sidebar.collapsed = true;
        sidebar.cells = [];
        sidebar.marker = null;
        sidebar.markerPosition = 0;

        // create html element for sidebar and add to page
        sidebar.element = $('<div id=sidebar-container>');
        $("#notebook").append(sidebar.element);
    };

    Sidebar.prototype.renderCells = function(cells){
        /* render notebook cells in the sidebar
        cells: list of cell objects from the main notebook */

        // remove any cells currently in sidebar
        this.cells = []
        $('#sidebar-cell-wrapper').remove();
        this.element.append($("<div/>")
            .attr('id', 'sidebar-cell-wrapper')
            .addClass('cell-wrapper'));

        // for each cell, create a new cell in the Sidebar with the same content
        for (i = 0; i < cells.length; i++){

            // add new cell to the sidebar
            newCell = this.createSidebarCell(cells[i]);
            $('#sidebar-cell-wrapper').append(newCell.element);
            this.cells.push(newCell);

            // make sure all code cells are rendered
            if(newCell.cell_type == 'code'){
                newCell.render();
                newCell.focus_editor();
            }

            // hide output if needed
            if(newCell.metadata.hide_input){
                newCell.element.find("div.output_wrapper").hide();
            }

            // intercept sidebar click events and apply them to original cell
            newCell._on_click = function(event){
                // unselect all cells in sidebar
                sb_cells = Jupyter.sidebar.cells
                for(j=0; j < sb_cells.length; j++){
                    sb_cells[j].selected = false;
                    sb_cells[j].element.removeClass('selected');
                    sb_cells[j].element.addClass('unselected');
                }

                // select this cell in the sidebar
                this.selected = true;
                this.element.removeClass('unselected');
                this.element.addClass('selected');

                // select the appropriate cell in the original notebook
                this.events.trigger('select.Cell', {
                    'cell':this.nb_cell,
                    'extendSelection':event.shiftKey
                });
            }

            // propigate edits in sidebar cell to main notebook cell
            newCell.code_mirror.on('change', function(){
                // based on the assumption that the changing code mirror is then
                // currently selected cell
                // could also use this.getWrapperElement() to get the codemirror
                // div and the cell's parent div, but this depends on stable DOM
                nb_cell = Jupyter.notebook.get_selected_cell()
                nb_cell.set_text(nb_cell.sb_cell.get_text())
            });
        }

        // focus the first cell in the sidebar
        if(cells.length > 0){
            cells[0].sb_cell.element.focus();
            if(cells[0].cell_type == 'code'){
                cells[0].sb_cell.focus_editor();
            }
        }

    }

    Sidebar.prototype.createSidebarCell = function(cell){
        /* Returns a sidebar cell that duplicates and is linked to a cell in the
        main notebook
        cell: a single cell object from the main notebook*/

        newCell = null

        // markdown cells
        if(cell.cell_type == 'markdown'){
            newCell = new TextCell.MarkdownCell({
                events: this.notebook.events,
                config: this.notebook.config,
                keyboard_manager: this.notebook.keyboard_manager,
                notebook: this.notebook,
                tooltip: this.notebook.tooltip,
            });
        }
        // code cells
        else if(cell.cell_type == 'code'){
            newCell = new CodeCell.CodeCell(this.notebook.kernel, {
                events: this.notebook.events,
                config: this.notebook.config,
                keyboard_manager: this.notebook.keyboard_manager,
                notebook: this.notebook,
                tooltip: this.notebook.tooltip,
            });
        }
        else if (cell.cell_type = 'raw'){
            newCell = new TextCell.RawCell({
                events: this.notebook.events,
                config: this.notebook.config,
                keyboard_manager: this.notebook.keyboard_manager,
                notebook: this.notebook,
                tooltip: this.notebook.tooltip,
            });
        }

        // populate sidebar cell with content of notebook cell
        cell_data = cell.toJSON();
        newCell.fromJSON(cell_data);

        // link the notebook and sidebar cells
        newCell.nb_cell = cell;
        cell.sb_cell = newCell;

        return newCell;
    }

    Sidebar.prototype.toggle = function(cells = []){
        /* expand or collapse sidebar
        cells: list of cell objects from the main notebook */

        // get ids for cells to render, and cells already in sidebar
        new_cell_ids = []
        old_cell_ids = []
        for(i=0; i<cells.length; i++){
            new_cell_ids.push(cells[i].metadata.janus_cell_id)
        }
        for(j=0; j<this.cells.length; j++){
            old_cell_ids.push(this.cells[j].metadata.janus_cell_id)
        }

        // expand sidebar if collapsed
        if(this.collapsed){
            this.expand()
            if(cells.length > 0){
                this.renderCells(cells)
            }
            highlightMarker(this.marker);
        }
        // update sidebar if new cells, or new cell border
        // this comparison method seems hacky
        else if(JSON.stringify(old_cell_ids) != JSON.stringify(new_cell_ids)){
            this.element.animate({
                top: this.markerPosition - 12,
            }, 400)
            if(cells.length > 0){
                Jupyter.sidebar.renderCells(cells)
            }
            highlightMarker(this.marker)
            cells[0].focus_editor();
            nb_cells = Jupyter.notebook.get_cells()
            for(i=0; i < nb_cells.length; i++){
                if(cells[0].metadata.janus_cell_id == nb_cells[i].metadata.janus_cell_id){
                    Jupyter.notebook.scroll_to_cell(i, 500)
                }
            }

        }
        // otherwise collapse sidebar
        else{
            this.collapse()
            highlightMarker(null)
        }
    }

    Sidebar.prototype.expand = function(){
        /* Show sidebar expanding from left of page */

        // only proceed if sidebar is collapsed
        if(! this.collapsed){
            return;
        }

        this.collapsed = false;
        var site_height = $("#site").height();
        var site_width = $("#site").width();
        var sidebar_width = (site_width - 70) / 2; // 40 pixel gutter + 15 pixel padding on each side of page

        $('#sidebar-cell-wrapper').show()

        $("#notebook-container").animate({
            marginLeft: '15px',
            width: sidebar_width
        }, 400, function(){
            Jupyter.sidebar.element.animate({
                right: '15px',
                width: sidebar_width,
                top: $(Jupyter.sidebar.marker).position().top - 12,
                padding: '0px'
            }, 400, function(){ // ensure code cells are fully rendered
                sb_cells = Jupyter.sidebar.cells
                for(i = 0; i < sb_cells.length; i++){
                    if(sb_cells[i].cell_type == 'code'){
                        sb_cells[i].render();
                        sb_cells[i].focus_editor();
                    }
                }
                sb_cells[0].focus_editor();
                nb_cells = Jupyter.notebook.get_cells()
                for(i=0; i < nb_cells.length; i++){
                    if(sb_cells[0].metadata.janus_cell_id == nb_cells[i].metadata.janus_cell_id){
                        Jupyter.notebook.scroll_to_cell(i, 500)
                    }
                }
            })
        });
    };

    Sidebar.prototype.collapse = function(){
        /* Collapse the sidebar to the right page border */

        // only proceed if sidebar is expanded
        if(this.collapsed){
            return;
        }

        this.collapsed = true;
        var menubar_width = $("#menubar-container").width();
        var site_width = $("#site").width();
        var margin = (site_width - menubar_width) / 2

        // need to use exact values for animation, then return to defaults
        $("#notebook-container").animate({
            marginLeft: margin,
            width: menubar_width
            }, 400, function(){
                $("#notebook-container").css( 'margin-left', 'auto' )
                $("#notebook-container").css( 'width', '' )
        })

        this.element.animate({
            right: '15px',
            width: 0,
            padding: '0px'
        }, 400, function(){
                $('#sidebar-cell-wrapper').hide(); // only hide after animation finishes
        });
    };

    Sidebar.prototype.update = function(){
        /* update the cells rendered in the sidebar, such as after deletion */

        if(!this.collapsed){
            // get list of previous cells in sidebar and currently hidden cells
            nb_cells = Jupyter.notebook.get_cells()
            old_cell_ids = []
            hidden_cell_ids = []

            for(j=0; j<this.cells.length; j++){
                old_cell_ids.push(this.cells[j].metadata.janus_cell_id)
            }
            for(i=0; i<nb_cells.length; i++){
                if(nb_cells[i].metadata.cell_hidden){
                    hidden_cell_ids.push(nb_cells[i].metadata.janus_cell_id)
                }
            }

            // find the first hidden cell that was in our previous sidebar
            var first_hidden = null
            for(k=0; k<hidden_cell_ids.length; k++){
                if(old_cell_ids.indexOf(hidden_cell_ids[k]) >= 0 ){
                    first_hidden = hidden_cell_ids[k]
                    break
                }
            }

            // if none found, then collapse the sidebar
            if(first_hidden == null){
                this.collapse()
            }
            // else update the sidebar
            else{
                // get placeholder with the top previous hidden cell in it
                placeholders = $('.placeholder').toArray()
                for(i=0; i<placeholders.length; i++){
                    if($(placeholders[i]).data('ids').indexOf(first_hidden) >= 0){
                        Jupyter.sidebar.marker = placeholders[i];
                        Jupyter.sidebar.markerPosition = $(placeholders[i]).position().top
                        showSidebarWithCells($(placeholders[i]).data('ids'))
                        break
                    }
                }
            }
        }
    }

    Sidebar.prototype.hideIndentedCells = function(){
        // hide all indented cells and render placeholders in their place

        $(".placeholder").remove()

        cells = Jupyter.notebook.get_cells();
        serial_hidden_cells = []

        for(i = 0; i < cells.length; i++){
            // make sure all cells have the right metadata
            if (cells[i].metadata.cell_hidden === undefined){
                cells[i].metadata.cell_hidden = false;
            }
            // make sure all cells have a unique Janus id
            if (cells[i].metadata.janus_cell_id === undefined){
                cells[i].metadata.janus_cell_id = Math.random().toString(16).substring(2);
            }

            // keep track of groups of hidden cells
            if(cells[i].metadata.cell_hidden){
                serial_hidden_cells.push(cells[i])
                if(i == cells.length - 1){
                    cell_ids = []
                    for(j = 0; j < serial_hidden_cells.length; j++){
                        serial_hidden_cells[j].element.addClass('hidden');
                        cell_ids.push(serial_hidden_cells[j].metadata.janus_cell_id);
                    }
                    // create placeholder that will render this group of hidden cells
                    addPlaceholderAfterElementWithIds(serial_hidden_cells[serial_hidden_cells.length - 1].element, cell_ids)

                    serial_hidden_cells = []
                }
            }
            else{
                // if this cell is visible but preceeded by a hidden cell
                if(serial_hidden_cells.length > 0){
                    // hide the previously cells and get a list of their ids
                    cell_ids = []
                    for(j = 0; j < serial_hidden_cells.length; j++){
                        serial_hidden_cells[j].element.addClass('hidden');
                        cell_ids.push(serial_hidden_cells[j].metadata.janus_cell_id);
                    }
                    // create placeholder that will render this group of hidden cells
                    addPlaceholderAfterElementWithIds(serial_hidden_cells[serial_hidden_cells.length - 1].element, cell_ids)

                    serial_hidden_cells = []
                }
            }
        }
    }

    function highlightMarker(marker){
        /*  highlight the marker clicked to show the sidebar
        marker: dom element, or null */

        $('.placeholder').removeClass('showing')
        $('.hidden-code-marker').removeClass('showing')
        if(marker != null){
            $(marker).addClass('showing')
        }
    }

    function createSidebar() {
        /* create a new sidebar element */

        return new Sidebar(Jupyter.notebook);
    }

    function load_css() {
        /* Load css for sidebar */
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";
        link.href = require.toUrl("./main.css");
        document.getElementsByTagName("head")[0].appendChild(link);
    };

    function renderJanusMenu(){
        // add menu items for indenting and unindenting cells
        var editMenu = $('#edit_menu');

        editMenu.append($('<li>')
            .addClass('divider')
        );

        editMenu.append($('<li>')
            .attr('id', 'indent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Indent Cell')
                .click(indentCell)
            )
        );

        editMenu.append($('<li>')
            .attr('id', 'unindent_cell')
            .append($('<a>')
                .attr('href', '#')
                .text('Unindent Cell')
                .click(unindentCell)
            )
        );

        editMenu.append($('<li>')
            .attr('id', 'toggle_cell_input')
            .append($('<a>')
                .attr('href', '#')
                .text('Toggle Cell Input')
                .click(toggleInput)
            )
        );
    }

    function renderJanusButtons() {
        /* add buttons to toolbar fo hiding and showing cells*/

        var toggleInputAction = {
            icon: 'fa-code',
            help    : 'Toggle Input',
            help_index : 'zz',
            handler : toggleInput
        };

        var indentAction = {
            icon: 'fa-indent',
            help    : 'Indent cells',
            help_index : 'zz',
            handler : indentCell
        };

        var unindentAction = {
            icon: 'fa-outdent',
            help    : 'Unindent cells',
            help_index : 'zz',
            handler : unindentCell
        };

        var prefix = 'janus';

        var full_toggle_action_name = Jupyter.actions.register(toggleInputAction,
                                                            'toggle-cell-input',
                                                            prefix);
        var full_indent_action_name = Jupyter.actions.register(indentAction,
                                                            'indent-cell',
                                                            prefix);
        var full_unindent_action_name = Jupyter.actions.register(unindentAction,
                                                            'unindent-cell',
                                                            prefix);

        Jupyter.toolbar.add_buttons_group([full_indent_action_name,
                                        full_unindent_action_name,
                                        full_toggle_action_name]);
    }

    function renderCodeMarker(cell){
        if(cell.metadata.hide_input){
            // clear any current code hidden markers
            var output_area = cell.element.find('div.output_wrapper')[0]
            var markers = output_area.getElementsByClassName('hidden-code-marker')
            while(markers[0]){
                markers[0].parentNode.removeChild(markers[0]);
            }

            // add the new marker
            var newElement = document.createElement('div');
            newElement.className = "hidden-code-marker fa fa-code"
            newElement.onclick = function(){showCodeInSidebar(cell, newElement)};
            output_area.appendChild(newElement)
        }
        else if (cell.cell_type == 'code'){
            // clear any current code hidden markers
            var output_area = cell.element.find('div.output_wrapper')[0]
            if(output_area){
                var markers = output_area.getElementsByClassName('hidden-code-marker')
                while(markers[0]){
                    markers[0].parentNode.removeChild(markers[0]);
                }
            }
        }
    }

    function renderAllCodeMarkers(){
        all_cells = Jupyter.notebook.get_cells()
        for(i=0; i < all_cells.length; i++){
            renderCodeMarker(all_cells[i]);
        }
    }

    function toggleInput(){
        var cell = Jupyter.notebook.get_selected_cell();
        // Toggle visibility of the input div
        cell.element.find("div.input").toggle('slow');
        cell.metadata.hide_input =! cell.metadata.hide_input;
        renderCodeMarker(cell);
    }

    function showCodeInSidebar(cell, marker){
        Jupyter.sidebar.marker = marker
        Jupyter.sidebar.markerPosition = $(cell.element).position().top
        Jupyter.sidebar.toggle([cell])
    }

    function updateInputVisibility() {
        Jupyter.notebook.get_cells().forEach(function(cell) {
            // ensure each cell has this metadata
            if(cell.metadata.hide_input == undefined){
                cell.metadata.hide_input = false;
            }
            // hide cells if needed
            if (cell.metadata.hide_input) {
                cell.element.find("div.input").hide();
            }
        })
    };

    function indentCell(){
        cells = Jupyter.notebook.get_selected_cells();

        // find where the selected cells are in the notebook
        all_cells = Jupyter.notebook.get_cells()
        sel_start_id = all_cells.indexOf(cells[0])
        sel_end_id = all_cells.indexOf(cells[cells.length - 1])
        start_id = all_cells.indexOf(cells[0])
        end_id = all_cells.indexOf(cells[cells.length - 1])

        // check if the prior cell(s) is/are already hidden
        while(start_id > 0){
            if(all_cells[start_id - 1].metadata.cell_hidden == true){
                start_id = start_id -1
            }
            else{
                break
            }
        }

        // check if the next cell(s) is/are already hidden
        while(end_id < all_cells.length - 1){
            if(all_cells[end_id + 1].metadata.cell_hidden == true){
                end_id = end_id + 1
            }
            else{
                break
            }
        }

        // get rid of the existing placeholder divs in our selection
        start_element = all_cells[start_id].element
        end_element = $(all_cells[end_id].element).next()
        contained_placeholders = $(start_element).nextUntil(end_element).add(end_element).filter('div.placeholder')
        $(contained_placeholders).remove()

        // get the whole expanded selection of hidden cells_to_copy
        hidden_cells = all_cells.slice(start_id, end_id+1)
        cell_ids = []

        // set the metadata and hide cells
        for(i=0; i < hidden_cells.length; i++){
            hidden_cells[i].metadata.cell_hidden = true;
            hidden_cells[i].element.addClass('hidden');
            cell_ids.push(hidden_cells[i].metadata.janus_cell_id)
        }

        // put placeholder div immediatley after it
        addPlaceholderAfterElementWithIds(hidden_cells[hidden_cells.length - 1].element, cell_ids)
        Jupyter.sidebar.update()
    }

    function addPlaceholderAfterElementWithIds(elem, cell_ids){
        elem.after($('<div>')
            .addClass('placeholder')
            .data('ids', cell_ids.slice())
            .click(function(){
                that = this;
                Jupyter.sidebar.marker = that;
                Jupyter.sidebar.markerPosition = $(that).position().top;
                showSidebarWithCells($(this).data('ids'))
            })
            .text(`${cell_ids.length}`))
    }

    function showSidebarWithCells(cell_ids){
        // get the cells we should show
        cells = Jupyter.notebook.get_cells()
        cells_to_copy = []
        for(i=0; i<cells.length; i++){
            if ( $.inArray( cells[i].metadata.janus_cell_id, cell_ids ) > -1 ){
                cells_to_copy.push(cells[i])
            }
        }
        Jupyter.sidebar.toggle(cells_to_copy)
    }

    function unindentCell(){
        // move selected cells back to main notebook

        cells = Jupyter.notebook.get_selected_cells();

        // make hidden cells visible
        for(i=0; i<cells.length; i++){
            cells[i].element.removeClass('hidden')
            cells[i].metadata.cell_hidden = false
            cells[i].set_text(cells[i].sb_cell.get_text())
            cells[i].render()
        }

        // remove any hidden cells from the sidebar
        for(j=0; j<Jupyter.sidebar.cells.length; j++){
            if(Jupyter.sidebar.cells[j].selected){
                Jupyter.sidebar.cells[j].element.addClass('hidden')
                Jupyter.sidebar.cells[j].element.remove()
                Jupyter.sidebar.cells.splice(i, 1)
            }
        }
        Jupyter.sidebar.hideIndentedCells()
        Jupyter.sidebar.update()
    }

    function load_extension(){
        /* Called as extension loads and notebook opens */
        console.log('[Janus] is working');
        load_css();
        renderJanusMenu();
        renderJanusButtons();
        createSidebar();
        JanusPatch.applyJanusPatches();

        if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
            // notebook already loaded. Update directly
            Jupyter.sidebar.hideIndentedCells();
            updateInputVisibility();
            renderAllCodeMarkers();
        }

        events.on("notebook_loaded.Notebook", Jupyter.sidebar.hideIndentedCells);
        events.on("notebook_loaded.Notebook", updateInputVisibility);
        events.on("notebook_loaded.Notebook", renderAllCodeMarkers);
    }

    return {
        load_jupyter_extension: load_extension,
        load_ipython_extension: load_extension
    };
});
