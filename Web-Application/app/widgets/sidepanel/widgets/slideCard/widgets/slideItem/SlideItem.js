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
    'dojo/dom-attr',
    'dojo/NodeList-dom',

    "dijit/_WidgetBase",
    'dijit/_TemplatedMixin',

    'dojo/text!./SlideItem.html'],

function(declare, domAttr, nld,
    _WidgetBase, _TemplatedMixin,
    template) {

    "use strict";

    return declare([_WidgetBase, _TemplatedMixin], {

        templateString: template,

        constructor: function() {

        },

        postCreate: function() {

            domAttr.set(this.slideCardImg, 'src', this.imgURL);
            this.slideCardTitle.innerHTML = this.title;
            this.slideCardText.innerHTML = this.desc;
            domAttr.set(this.slideCardContainer, 'id', this.id);
            domAttr.set(this.slideCardContainer, 'title', this.title);

        },

        startup: function() {

        }

    });
});
