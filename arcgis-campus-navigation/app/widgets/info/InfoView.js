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
    'dojo/_base/window',
    'dojo/query',
    'dojo/on',
    'dojo/NodeList-dom',
    "dojo/topic",

    "dijit/_WidgetBase",
    'dijit/_TemplatedMixin',

    'dojo/text!./InfoView.html'],

function(declare, win, dojoQuery, dojoOn, nld, topic,
    _WidgetBase, _TemplatedMixin,
    template) {

    "use strict";

    return declare([_WidgetBase, _TemplatedMixin], {

        templateString: template,
        id: 'info-btn',
        isRouting: false,

        constructor: function(options) {

            // this.view = options.view;
            // this.map = this.view.map;
            this.containerDiv = options.containerDiv;
        },

        postCreate: function() {

            this._addEventListeners();
        },

        // listen for a click event on the InfoBtn
        _addEventListeners: function() {
            var thisNode = this;
            dojoOn(win.doc, ".js-info-btn:click", function() {
                thisNode._operateSidePanel();
            });
        },

        startup: function() {

            this.placeAt(this.containerDiv);
        },

        // function to communicate to the side panel via main.js (main controller)
        _operateSidePanel: function() {
            var infoBtn = dojoQuery(".js-info-btn");

            // check the routing flag
            if (this.isRouting === false) {
                infoBtn.addClass('is-active');
                infoBtn.removeClass('is-hidden');
                topic.publish("sidePanel/open", { card: "info" });
            } else if (this.isRouting === true) {
                // if the routing flag is set we are going to toggle the side panel so we don't
                // clear the route mode
                topic.publish("sidePanel/toggle");
            }
        },

        // function to reset styles of InfoBtn to default
        reset: function() {
            var infoBtn = dojoQuery(".js-info-btn");

            infoBtn.removeClass('is-active');
            infoBtn.removeClass('is-hidden');
        },

        // function to set styles to make the InfoBtn transparent
        hide: function() {
            dojoQuery(".js-info-btn").addClass('is-hidden');
        },

        // function that will direct the routing mode processes
        routeInProgress: function(status) {
            var infoBtn = dojoQuery(".js-info-btn");

            // if this function is called we set the route mode to true or keep it true
            this.isRouting = true;

            // sending status 'open' to the side panel will open the side panel with route card
            // and show arrow button to collapse panel
            if (status === 'open') {
                infoBtn.addClass('is-routing');
                infoBtn.removeClass('is-active');
                infoBtn.removeClass('is-routing-hidden');
                infoBtn.removeClass('is-hidden');
            }
            // sending status 'close' to the side panel will collapse panel but keep route card active
            // for the reopen of panel, also switched arrows for expand
            else if (status === 'close') {
                infoBtn.removeClass('is-routing');
                infoBtn.addClass('is-routing-hidden');
            }
            // sending status 'clear' to the side panel will reset to default styles of InfoBtn and
            // clear routing mode
            else if (status === 'clear') {
                infoBtn.removeClass('is-routing');
                infoBtn.removeClass('is-routing-hidden');
                this.isRouting = false;
            }

        }

    });
});
