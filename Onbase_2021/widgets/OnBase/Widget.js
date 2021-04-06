//#region AMD Imports
define(["dojo/_base/declare", "jimu/BaseWidget", "dojo/dom-style", "dojo/html",
    "jimu/LayerInfos/LayerInfos", "jimu/dijit/ItemSelector", "dojo/_base/lang", "dijit/_WidgetsInTemplateMixin",
    "jimu/loaderplugins/jquery-loader!//code.jquery.com/jquery-1.11.0.min.js"
], function(
    declare, BaseWidget, domStyle, html,
    LayerInfos, ItemSelector, lang
)
{
//#endregion

    return declare([BaseWidget],
    {
        //#region Instance Variables
        OB_WEB_API_FILENAME: "/OB_WebAPI.min.js",
        OB_VIEWMODEL_FILENAME: "/OBWidgetViewModel.min.js",
		OB_VERSIONAGENT_FILENAME: "/OBVersionAgent.min.js",
        CONFIG_PROP_SERVICEURL: "obServiceUrl",
        CONFIG_PROP_PORTALSERVICEURL: "portalWidgetUrl",
        baseClass: "jimu-widget-OnBase",
        versionStampQueryString: "",
        wScope: null,
        obApiJSpath: null, //Local relative path 
        portalWidgetJSPath: "", //Portal Url path
        obApiViewModel: null,
        useWABSelectToolAutoUpdate: false,
        //#endregion

        /* dojo dijit */
        postCreate: function()
        {
            LayerInfos.getInstance(this.map, this.map.itemInfo)
            .then(lang.hitch(this, function(layerInfos)
            {
                this.layerInfos = layerInfos;
            }));
        },

        /* dojo dijit */
        startup: function()
        {
            this.inherited(arguments);

            wScope = this;

            //get the API path without an ending / if it was added
            wScope.obApiJSpath = this.config.obJS_API_Path.replace(/\/$/, "");

            wScope.portalWidgetJSPath = wScope.config[wScope.CONFIG_PROP_PORTALSERVICEURL];

            //The path to the JS files may not be the same as the path of the widget.js execution
            if (wScope.portalWidgetJSPath !== null && wScope.portalWidgetJSPath !== "")
            {
                wScope.portalWidgetJSPath = wScope.portalWidgetJSPath.replace(/\/$/, ""); // path without an ending / if it was added

                if (console)
                {
                    console.log("Portal Widget URL used from: '" + wScope.portalWidgetJSPath + "'");
                }

                wScope.obApiJSpath = wScope.portalWidgetJSPath;//override the relative path
            }

            wScope.useWABSelectToolAutoUpdate = this.config.useWABSelectToolAutoUpdate;

            wScope.setWidgetInstanceAsync().then(function()
            {
                wScope.obApiViewModel.checkSessionAsync();
            });
        },

        createObApiAndObViewModelAsync: function()
        {
            var jqDeferred = $.Deferred();

            var obApiJSpathAPI = wScope.obApiJSpath + wScope.OB_WEB_API_FILENAME + wScope.versionStampQueryString;
            var viewModelPath = wScope.obApiJSpath + wScope.OB_VIEWMODEL_FILENAME + wScope.versionStampQueryString;

            try
            {
                require([obApiJSpathAPI, viewModelPath], function(OBWebAPI, OBWidgetViewModel)
                {
                    var obApi = new OBWebAPI(wScope.config[wScope.CONFIG_PROP_SERVICEURL], true, false);

                    obApi.getInstanceAsync().then(function(instance)
                    {
                        instance.createWidgetAsync(wScope.map, OBWidgetViewModel)
                        .then(function(viewModel)
                        {
                            wScope.obApiViewModel = viewModel;

                            if (wScope.useWABSelectToolAutoUpdate)
                            {
                                wScope.obApiViewModel.restrictAutoQueryingForResults(false);
                                wScope.obApiViewModel.setBypassConfigLayerCheck(true);
                            }

                            jqDeferred.resolve(viewModel);
                        });
                    });
                });
            }
            catch (ex)
            {
                if (console)
                {
                    console.error("OnBase: An exception occurred creating the obApi and/or widget viewmodel. " + ex.message);
                }
                jqDeferred.reject(ex.message);
            }

            return jqDeferred;
        },


        getVersionAgentAndSetStampAsync: function()
        {
            var jqDeferred = $.Deferred();

            try
            {
                require([wScope.obApiJSpath + wScope.OB_VERSIONAGENT_FILENAME],
                function(OnBaseVersionAgent)
                {
                    OnBaseVersionAgent.getVersionStampQueryStringAsync(wScope.config[wScope.CONFIG_PROP_SERVICEURL])
                    .then(function(versionStampQueryString)
                    {
                        wScope.versionStampQueryString = versionStampQueryString;
                    })
                    .fail(function(err)
                    {
                        if (console)
                        {
                            console.error("OnBase: An error occurred calling getVersionStampQueryStringAsync. " + err);
                        }
                    })
                    .always(function()
                    {
                        jqDeferred.resolve();
                    });
                });
            }
            catch (ex)
            {
                //log the error and resolve here, because it shouldn't stop the program completely
                //if we simply couldn't get a version stamp.
                if (console)
                {
                    console.error("OnBase: An exception occurred getting the version stamp. " + ex.message);
                }
                jqDeferred.resolve();
            }
            return jqDeferred;
        },

        setWidgetInstanceAsync: function()
        {
            return wScope.getVersionAgentAndSetStampAsync()
                .then(wScope.createObApiAndObViewModelAsync);
        }
    });
});