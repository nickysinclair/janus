/**
 * Defining toolbar buttons and menu, binding functions, and rendering UI
 */

define([
    "jquery",
    "base/js/namespace",
    "../alternatives-nb/addAlternativesView",
    "../alternatives-nb/alternativeController",
], function($, Jupyter, addAlternativesView, alternativeController) {
    function addItemToMenu(menu, id, text, click) {
        /**
         * add <li> to menu
         *
         * Args:
         *  - menu: menu item to append <li> to
         *  - id: css id
         *  - text: text to put on menuitem
         *  - click: action to take on item click
         */

        menu.append(
            $("<li>")
            .attr("id", id)
            .append($("<a>").attr("href", "#").text(text).click(click))
        );
    }

    // Placeholder function for menu/toolbar to work until actions created
    function logFunc() {
        console.log("abc");
    }

    /**
     * Icons available at https://fontawesome.com/
     * Icon version must be available in fa version 4.7, pinned version
     * per https://github.com/jupyter/notebook/blob/master/bower.json
     */
    var items = [
        [{
                name: "add_alternatives",
                display_name: "Add Alternatives",
                action: addAlternativesView.createAddAlternativesModal,
                icon: "fa-columns",
            },
            {
                name: "delete_alternatives",
                display_name: "Delete Alternatives",
                action: alternativeController.deleteAlternatives,
                icon: "fa-trash",
            },
        ],
        [{
                name: "set_alternatives_status_choice",
                display_name: "Set Alternatives: Choice",
                action: alternativeController.setStatusChoice,
                icon: "fa-check-circle",
            },
            {
                name: "set_alternatives_status_option",
                display_name: "Set Alternatives: Option",
                action: alternativeController.setStatusOption,
                icon: "fa-th-large",
            },
            {
                name: "set_alternatives_status_archived",
                display_name: "Set Alternatives: Archived",
                action: alternativeController.setStatusArchived,
                icon: "fa-archive",
            },
        ],
    ];

    function setNavigationMenu() {
        // Create the navigation bar
        var navbar = $("#menubar .nav").first();
        navbar.append(
            $("<li>")
            .addClass("dropdown")
            .attr("id", "alternatives-nb-header")
            .append(
                $("<a>")
                .addClass("dropdown-toggle")
                .attr("href", "#")
                .attr("data-toggle", "dropdown")
                .text("Alternatives")
            )
        );

        // Add an alternatives-nb header and add menu to it
        var alternativesNBHeader = $("#alternatives-nb-header");
        alternativesNBHeader.append(
            $("<ul>").addClass("dropdown-menu").attr("id", "alternatives-nb-menu")
        );
    }

    function addItems(items) {
        /**
         * Function adding items to menu and toolbar according to data
         * structure defined in `var items`
         *
         * Args:
         *  - items: JSON data defining available actions with UI buttons
         */

        // Loop array of arrays and extract action information from dictionary
        // to render menu and buttons

        setNavigationMenu();

        var alternativesNBMenu = $("#alternatives-nb-menu");
        var prefix = "alternatives-nb";
        var actionHandler = Jupyter.actions;
        for (let i = 0; i < items.length; i++) {
            var handledActions = [];
            for (let j = 0; j < items[i].length; j++) {
                // Add to menu
                addItemToMenu(
                    alternativesNBMenu,
                    items[i][j].name,
                    items[i][j].display_name,
                    items[i][j].action
                );

                // Toolbar work
                var action = {
                    icon: items[i][j].icon,
                    help: items[i][j].display_name,
                    help_index: "zz",
                    handler: items[i][j].action,
                };

                var handledAction = actionHandler.register(
                    action,
                    items[i][j].name.replaceAll("_", "-"),
                    prefix
                );

                handledActions.push(handledAction);
            }

            // If next group exists, add a line divider
            if (items[i + 1]) {
                alternativesNBMenu.append($("<li>").addClass("divider"));
            }

            // Add group to toolbar
            Jupyter.toolbar.add_buttons_group(handledActions);
        }
    }

    function renderHeaderUI() {
        /** Render both menu items and toolbar buttons */

        addItems(items);
    }

    return {
        renderHeaderUI: renderHeaderUI,
    };
});