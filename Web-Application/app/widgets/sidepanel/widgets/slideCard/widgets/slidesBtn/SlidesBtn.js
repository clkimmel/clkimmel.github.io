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
    'dojo/_base/lang',
    'dojo/dom-class',
    'dojo/NodeList-manipulate',
    'dojo/topic',
    'dojo/on',
    'dojo/NodeList-dom',

    // './widgets/slideCard/SlideCard',

    "dijit/_WidgetBase",
    'dijit/_TemplatedMixin',

    'dojo/text!./SlidesBtn.html'],

function(declare, lang, domClass, dojoManip, topic, dojoOn, nld,
    _WidgetBase, _TemplatedMixin,
    template) {

    "use strict";

    return declare([_WidgetBase, _TemplatedMixin], {

        templateString: template,
        id: 'slides',

        constructor: function(options) {

            this.view = options.view;
            // this.map = this.view.map;
            this.containerDiv = options.containerDiv;
        },

        startup: function() {

            this.placeAt(this.containerDiv);

            $('.js-tooltip').tooltip();

            this._addEventListeners();
        },

        _addEventListeners: function() {
            this.own(
                dojoOn(this.slideBtn, 'click', lang.hitch(this, function() {
                    topic.publish("slideBtn/click");
                    topic.publish("sidePanel/open", { card: "slides" });
                    this.select();
                }))
            );
        },

        routeInProgress: function(status) {

            // // sending status 'open' to the side panel will open the side panel with route card
            // // and show arrow button to collapse panel
            // if (status === 'open') {
            //     domClass.add(this.slideBtn, 'is-hidden');
            // }
            // // sending status 'clear' to the side panel will reset to default styles of InfoBtn and
            // // clear routing mode
            // else if (status === 'clear') {
            //     domClass.remove(this.slideBtn, 'is-hidden');
            // }

        },

        select: function() {
            domClass.add(this.slideBtn, 'is-selected');
        },

        deselect: function() {
            domClass.remove(this.slideBtn, 'is-selected');
        }

    });
});
