/*
| Copyright 2016 Esri
|
| Licensed under the Apache License, Version 2.0 (the "License");
| you may not use this file except in compliance with the License.
| You may obtain a copy of the License at
|
| http://www.apache.org/licenses/LICENSE-2.0
|
| Unless required by applicable law or agreed to in writing, software
| distributed under the License is distributed on an "AS IS" BASIS,
| WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
| See the License for the specific language governing permissions and
| limitations under the License.
*/
define([
    'dojo/_base/declare',
    'dojo/dom-class',
    'dojo/NodeList-dom',

    "esri/widgets/NavigationToggle",

    "dijit/_WidgetBase",
    'dijit/_TemplatedMixin',

    'dojo/text!./NavToggle.html'],

function(declare, domClass, nld,
    NavigationToggle,
    _WidgetBase, _TemplatedMixin,
    template) {

    "use strict";

    return declare([_WidgetBase, _TemplatedMixin], {

        templateString: template,

        constructor: function(options) {

            this.view = options.view;
            this.containerDiv = options.containerDiv;
        },

        startup: function() {

            this.placeAt(this.containerDiv);

            this.navToggle = new NavigationToggle({
                view: this.view,
                layout: "vertical",
                container: this.containerDiv
            });


            $('.js-tooltip-nav').tooltip();

            $('.esri-navigation-toggle').hover(function() {
                $('.js-tooltip-nav').tooltip('toggle');
            });
        },

        routeInProgress: function(status) {

            // sending status 'open' to the side panel will open the side panel with route card
            // and show arrow button to collapse panel
            if (status === 'open') {
                domClass.add(this.navToggleContainer, 'is-routing');
            }
            // sending status 'clear' to the side panel will reset to default styles of InfoBtn and
            // clear routing mode
            else if (status === 'clear') {
                domClass.remove(this.navToggleContainer, 'is-routing');
            }

        }

    });
});
