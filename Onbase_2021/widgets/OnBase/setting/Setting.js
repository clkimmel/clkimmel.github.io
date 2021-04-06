///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting',
    'dojo/Deferred',
    'jimu/dijit/SimpleTable',
    'dijit/form/ValidationTextBox',
    'dijit/form/CheckBox',
    'jimu/loaderplugins/jquery-loader!//code.jquery.com/jquery-1.11.0.min.js'
  ],
  function(
    declare,
    _WidgetsInTemplateMixin,
    BaseWidgetSetting,
    Deferred,
    Table) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      //these two properties are defined in the BaseWidget
        baseClass: 'jimu-widget-OnBase-setting',
       
      startup: function ()
      {
          this.inherited(arguments);

          //NOTE: Th config settings for the json widget logic are in config.json
          this.setConfig(this.config);
      },

      setConfig: function (config)
      {
          this.config = config;
        
            if (this.config)
            {
                if (this.config.obServiceUrl)
                    //&& this.serviceUrlTextBox.get('value').indexOf('http://[Servername]/OnBaseGISWebAPI/') === -1)
                {
                    this.serviceUrlTextBox.set('value', this.config.obServiceUrl);
                }

                //Cannot use .uncheck() that is for jimu/dijit/CheckBox not dijit/form/CheckBox
                //this.requireLoginCheckBox.set('checked', this.config.obRequireLogin);

                if (this.config.obJS_API_Path)
                {
                    this.jsApiPathTextBox.set('value', this.config.obJS_API_Path);
                }

                if (this.config.width)
                {
                    this.widthTextBox.set('value', this.config.width);
                }

                if (this.config.portalWidgetUrl)
                {
                    this.portalWidgetUrlTextBox.set('value', this.config.portalWidgetUrl);
                }

                console.log('OnBase-setting :: setConfig');
            }
      },

      getConfig: function ()
      {
          this.config.obServiceUrl = this.serviceUrlTextBox.get('value');
          //this.config.obRequireLogin = this.requireLoginCheckBox.checked;
          this.config.obJS_API_Path = this.jsApiPathTextBox.get('value');
          this.config.width = Number(this.widthTextBox.get('value'));
          this.config.portalWidgetUrl = this.portalWidgetUrlTextBox.get('value');

          $("#ob_div_working").show();
          var deferredObj = this._validateOBUrl();
          $("#ob_div_working").hide();

          console.log('OnBase-setting :: getConfig ' + this.config.obServiceUrl);
         
         return this.config;
      },

      _validateOBUrl: function ()
      {
          //var curURL = window.location.protocol + "//" + window.location.host + "/" + window.location.pathname;
          //curURL = curURL.slice(0, -7); //remove setting folder

          var _OBWebAPIJSName = "/OB_WebAPI.min.js";
          var url = this.serviceUrlTextBox.get('value');

          var portalUrl = this.portalWidgetUrlTextBox.get('value');

          var obApiPath = portalUrl !== "" ? portalUrl  :  "../" + this.jsApiPathTextBox.get('value'); //We assume it is one folder up from settings

          console.log("Require: " + obApiPath + _OBWebAPIJSName);
          var jqDeferred = $.Deferred();

          require([obApiPath + _OBWebAPIJSName], function (OBWebAPI)
          {
              var obApi = new OBWebAPI(url, true, true);
              obApi.clearInstance();

              obApi.getInstanceAsync()
                       .then(function(instance)
                       {
                           instance.getConfiguredLayersAsync(true).then(function (cfgLays)
                           {

                               if (cfgLays === null || cfgLays === undefined || cfgLays === "")
                               {
                                   var warnMsg = 'OnBase-setting -  Error getting configured layers. The url ' + url + ' is likely correct, but check that there are';

                                   warnMsg += 'no server side errors such as a login is required, etc.  ';
                                   warnMsg += 'Ultimately, the true test will be once you deploy your WAB application and attempt to retrieve data from OnBase in a deployed environment.';

                                   console.warn(warnMsg);

                                   jqDeferred.resolve(false);

                               }
                               else
                               {
                                   jqDeferred.resolve(true);
                                   console.log('OnBase-setting  - ConfigLayers: ' + JSON.stringify(cfgLays));
                               }
                           });

                       }).fail(console.warn("OnBase-setting  - OBWebAPI did not initialize."));
          });

          return jqDeferred;
      },

        //TODO - Validate service URL via UI
      _onBtnValidateOBClick: function ()
      {
          var def = new Deferred();

          var isValidate = this.serviceUrlTextBox.validate();

          if (isValidate)
          {
              var valid = this._validateOBUrl();

              if (!valid)
              {
                  def.reject();
              }
              else
              {
                  def.resolve();
              }
          }
          else
          {
              def.reject();
          }

          return def;
      }

    });
  });