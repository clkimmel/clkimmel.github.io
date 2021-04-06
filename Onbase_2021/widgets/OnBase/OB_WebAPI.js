var OnBaseWebApi = (function()
{
    // #region Private Variables
    var _esriMap;
    var _esriJsVersion;
    var _isLogConsoleDebugMode = false;
    var _errorDivId = "";
    var _isIncludeRefreshButton = true;
    var _instance = null;
    var _openedLoginWindow = null;
    var _requiredHitListScripts = null;
    var _requiredHitListCSS = null;
    var _obConfiguredLayers = null;
    var _requireApiLogin = null;
    var _selectedFeaturesForRefresh = null;
    var _esriResults = null;
    var _esriLayerIds = null;
    var _lastResultsUpdateTime = null;
    var _apiUrlSubPath = "api/GisService";
    var _clientConfigOptions = null;
    var _actionMenuState = null;
    var _loginPage = "";//_clientConfigOptions.LoginPage
    var _rootUrl = "";
    var _webApiUrl = "";
    var _refreshResultsHtml = "";
    var _loggedOutHtml = "";
    var _STR_RC_REFRESH = "";
    var _STR_RC_GIS_LOGIN_REFRESH = "";
    var _STR_RC_GIS_LOGIN_TRYAGAIN = "";
    var _STR_RC_GIS_HITLIST_LOGGINGIN = "";
    var _STR_RC_GIS_LAYER_NOTCONFIGURED_NONE = "";
    var _STR_RC_GIS_SELECTFEATURES = "";
    var _STR_RC_GIS_CLEARSELECTEDFEATS = "";
    var _STR_RC_GIS_RESPONSE_ERROR = "";
    var _STR_RC_GIS_CLOSE = "";
    var _longAttribute = ""; //_clientConfigOptions.XCOORD_CALC
    var _latAttribute = "";//_clientConfigOptions.YCOORD_CALC
    var _isIncludeDeviceCoordinates = true;//_clientConfigOptions.WidgetConfig.IsIncludeDeviceCoordinates
    var _isIncludeFeatureCoordinates = true;//_clientConfigOptions.WidgetConfig.IsIncludeFeatureCoordinates

    var EnumLogType =
    {
        Log: "log",
        Error: "error",
        Info: "info",
        Verbose: "verbose",
        Warn: "warn"
    };
    //#endregion

    function init()
    {
        //#region Private Functions
        // _getClientConfigurationAsync should be called first to determine if there is a filter to be used
        function _hasFilterApplied()
        {
            var hasFilterDataLocal = false;

            //Is there a filter action menu item? If not, do not allow filtering.
            if (_clientConfigOptions !== null && _clientConfigOptions.WidgetConfig.WidgetActionMenuOptions.IsShowActionMenuFilter === true)
            {
                //TODO: Support the concept of On/Off based on the user's choice. Update the server as well.
                //Currently if in storage, we assume it is applied to queries.
                var key = _determineFilterLocalStorageKeyName();
                var storageType = _getFilterStorageType();

                if (storageType !== null)
                {
                    var jsonData = ObGisStorage.getItem(key, storageType);

                    if (jsonData)
                    {
                        hasFilterDataLocal = true;
                    }
                }
            }

            return hasFilterDataLocal;
        }
        //NOTE: Currently there are multiple JS files which define this method.
        function _execAjaxRequestAsync(url, receivingType, data, sendingType, httpVerb, enableCaching)
        {
            // See http://api.jquery.com/jquery.ajax/ for settings object documentation.
            var jqAjaxSettings = {
                url: url,
                async: true,
                cache: false, // Example: Caching data in the browser for whether or not a user has a session would be problematic.
                type: httpVerb || "GET",
                dataType: receivingType,
                xhrFields: {
                    withCredentials: true
                }
            };

            if (enableCaching)
            {
                jqAjaxSettings.cache = true;
            }

            if (data)
            {
                jqAjaxSettings.data = data;
                jqAjaxSettings.contentType = sendingType;
                jqAjaxSettings.type = "POST";// if you send data, it is required to post
            }

            var failInfo = "OB_WebAPI._execAjaxRequestAsync:: error calling " + url;

            return $.ajax(jqAjaxSettings)
                    .fail(_getFailCallback(failInfo, true));//is called on ajax fail and only handles reject (not exceptions)
           
        }
        function _setFiltersFromBrowserAsync()
        {
            var jqDeferred = $.Deferred();

            if (_hasFilterApplied())
            {
                var storageType = _getFilterStorageType();
                var key = _determineFilterLocalStorageKeyName();
                var jsonData = ObGisStorage.getItem(key, storageType);

                var setFiltersFromBrowserUrl = _webApiUrl + "/" + "SetBrowserPersistedFilters";

                _execAjaxRequestAsync(setFiltersFromBrowserUrl, "text",
                    jsonData, "application/json", "POST")
                .always(function ()
                {
                    jqDeferred.resolve();
                });
                
            } 
            else
            {
                jqDeferred.resolve();
            }

            return jqDeferred;
        }
        function _getFilterStorageType()
        {
            var storageType = null;

            if (_clientConfigOptions !== null)
            {
                storageType = _clientConfigOptions.WidgetConfig.WidgetActionMenuOptions.IsPersistFilterInBrowser ? EnumObStorageType.LOCAL : EnumObStorageType.SESSION;
            }

            return storageType;
        }
        function _getClientConfigurationAsync()
        {
            var getClientConfigUrl = _webApiUrl + "/" + "GetClientConfiguration";

            //not returning any data, just returning a deferred so this method is 'then-able'
            return _execAjaxRequestAsync(getClientConfigUrl, "json")
            .then(function(data, textStatus, jqXHR)
            {
                _clientConfigOptions = data;
                _loginPage = _clientConfigOptions.LoginPage;
                _longAttribute = _clientConfigOptions.XCOORD_CALC;
                _latAttribute = _clientConfigOptions.YCOORD_CALC;
                _isIncludeDeviceCoordinates = _clientConfigOptions.WidgetConfig.IsIncludeDeviceCoordinates;
                _isIncludeFeatureCoordinates = _clientConfigOptions.WidgetConfig.IsIncludeFeatureCoordinates;
            });
        }

        function _getGetActionMenuStateAsync()
        {
            var getGetActionMenuStateUrl = _webApiUrl + "/" + "GetActionMenuState";

            //not returning any data, just returning a deferred so this method is 'then-able'
            return _execAjaxRequestAsync(getGetActionMenuStateUrl, "json")
            .then(function (data, textStatus, jqXHR)
            {
                _actionMenuState = data;
            });
        }

        function _getConfiguredLayersAsync(shouldClearCache, disableLoginPopup)
        {
            // may/may not call another async function, so need our own deferred
            var jqDeferred = $.Deferred();

            if (shouldClearCache)
            {
                _obConfiguredLayers = null;
                _log("_getConfiguredLayersAsync: cleared ob configured layers client cache.");
            }

            if (_obConfiguredLayers === null)
            {
                var getConfiguredLayersUrl = _webApiUrl + "/" + "GetConfiguredLayers";

                var cacheObConfiguredLayers = function(data)
                {
                    _obConfiguredLayers = data;
                    _log("_getConfiguredLayersAsync: ob configured layers are now cached.");
                };

                var getLayersAsync = function()
                {
                    return _execAjaxRequestAsync(getConfiguredLayersUrl, "json");
                };

                var handleRequiresSession = function(requiresSession)
                {
                    if (requiresSession && disableLoginPopup === true)
                    {
                        //don't pop the login control, just return null
                        jqDeferred.resolve(null);
                    }
                    else if (requiresSession)
                    {
                        _handle401();
                        jqDeferred.resolve(null);
                    }
                    else
                    {
                        _setFiltersFromBrowserAsync()
                            .then(getLayersAsync)
                            .then(cacheObConfiguredLayers)
                            .always(function()
                            {
                                //always return data to caller
                                jqDeferred.resolve(_obConfiguredLayers);
                            });
                    }
                };

                _requiresSessionAsync().then(handleRequiresSession);
            }
            else
            {
                jqDeferred.resolve(_obConfiguredLayers);
            }
            return jqDeferred;
        }

        function _retrieveDocumentsJsonAsync(selectedFeaturesLayers)
        {
            var retrieveDocumentsUrl = _webApiUrl + "/" + "RetrieveDocuments";
            var jsonFeatureLayers = JSON.stringify(selectedFeaturesLayers);

            _getConfiguredLayersAsync()
            .then(function()
            {
                return _execAjaxRequestAsync(retrieveDocumentsUrl, "json",
                    jsonFeatureLayers, "application/json")
                    .then(function(data)
                    {
                        _lastResultsUpdateTime = new Date();
                        return data;
                    });
            });
        }

        function _retrieveDocumentsHtmlAsync(selectedFeaturesLayers)
        {
            var retrieveDocsHtmlUrl = _webApiUrl + "/" + "RetrieveDocumentsHtml";
            var jqDeferred = $.Deferred();

            _setUpUIPrerequisites()
            .then(function()
            {
                if (selectedFeaturesLayers === undefined || selectedFeaturesLayers === null || selectedFeaturesLayers.length === 0)
                {
                    if (_STR_RC_GIS_LAYER_NOTCONFIGURED_NONE === "")
                    {
                        _bulkTranslateRCsAsync(["STR_RC_GIS_LAYER_NOTCONFIGURED_NONE"])
                        .then(function(data, textStatus, jqXHR)
                        {
                            _STR_RC_GIS_LAYER_NOTCONFIGURED_NONE = data[0];
                            jqDeferred.resolve(_STR_RC_GIS_LAYER_NOTCONFIGURED_NONE);
                        });
                    }
                    else
                    {
                        jqDeferred.resolve(_STR_RC_GIS_LAYER_NOTCONFIGURED_NONE);
                    }
                }
                else
                {
                    var jsonFeatureLayers = JSON.stringify(selectedFeaturesLayers);

                    _execAjaxRequestAsync(retrieveDocsHtmlUrl, "html",
                        jsonFeatureLayers, "application/json")
                    .then(function (data, textStatus, jqXHR)
                    {
                        _lastResultsUpdateTime = new Date();
                        jqDeferred.resolve(data);

                    }).fail(function (failObj)
                    {
                        if (failObj.done && failObj.fail && failObj.always)
                        {
                            // It's probably a jqXHR
                            jqDeferred.resolve("<div>" + _STR_RC_GIS_RESPONSE_ERROR + "</div>");
                        }
                    });
                }
            });
            return jqDeferred;
        }

        function _getObFeaturesFromEsriLayersAsync(featureLayers)
        {
            var jqDeferred = $.Deferred();
            var obSelectedFeatureLayers = [];

            _getConfiguredLayersAsync()
            .then(function()
            {
                for (i = 0; i < featureLayers.length; i++)
                {
                    var layer = featureLayers[i];
                    //Necessary to support Cityworks Integration.
                    var layerName = layer.obCityworksName || layer.name;

                    //Only check the configured layers               
                    if (_isConfiguredLayerId(layerName))
                    {
                        if (layer.visible)
                        {
                            //#region
                            var fields = layer.fields;
                            var obFeaturesArray = [];

                            var features = layer.getSelectedFeatures();

                            if (features.length > 0)
                            {
                                _log('_getObFeaturesFromEsriLayersAsync: Getting features for layer "' +
                                    layerName + '"', EnumLogType.Log);
                            }
                            else
                            {
                                _log('_getObFeaturesFromEsriLayersAsync: No features calling getSelectedFeatures on layer "' +
                                    layerName + '"', EnumLogType.Log);
                            }

                            for (var x = 0; x < features.length; x++)
                            {
                                var feature = features[x];
                                
                                _setCoordinates(feature);
                                
                                var obFeature = _createObFeature(feature.attributes, true, fields);
                                obFeaturesArray.push(obFeature);
                            }

                            var obSelectedFeaturelayer = null;

                            if (obFeaturesArray.length > 0)
                            {
                                //Add all the features for this layer
                                obSelectedFeaturelayer = _createObLayer(layerName, obFeaturesArray);
                            }

                            //This will be null if the layerName was not 
                            //configured or no features were selected in this layer
                            if (obSelectedFeaturelayer !== null)
                            {
                                obSelectedFeatureLayers.push(obSelectedFeaturelayer);
                            }

                            //#endregion
                        }
                        else
                        {
                            _log("_getObFeaturesFromEsriLayersAsync: Layer name '" + layerName +
                                "' configured layer not visible and ignored.");
                        }
                    }
                }
                jqDeferred.resolve(obSelectedFeatureLayers);
            });

            return jqDeferred;
        }

        function _setCoordinates(feature)
        {
            if (_isIncludeFeatureCoordinates)
            {
                //Get the map point of the feature for web links?
                var mapPoint = _getPointFromGeometry(feature.geometry);
                if (mapPoint && esri.geometry.webMercatorToGeographic)
                {
                    var mp = mapPoint.spatialReference.wkid === 4326 ? mapPoint :
                        esri.geometry.webMercatorToGeographic(mapPoint);

                    feature.attributes[_longAttribute] = mp.x.toFixed(3);
                    feature.attributes[_latAttribute] = mp.y.toFixed(3);
                    
                    _log("_setCoordinates: Added (x,y)" + mp.x.toFixed(3) + "," + mp.y.toFixed(3));
                }
                else
                {
                    
                    _log("_setCoordinates: Failed to get map point or load esri.geometry.webMercatorToGeographic.");
                }
            }
        }
        function _getPointFromGeometry(geometry)
        {
            var point = null;

            if (geometry.type === "polygon")
            {
                point = geometry.getCentroid();
            }
            else if (geometry.type === "multipoint")
            {
                _log("_getPointFromGeometry: Cannot get point from Multipoint", EnumLogType.Info);
            }
            else if (geometry.type === "polyline")
            {
                _log("_getPointFromGeometry: Cannot get point from Polyline", EnumLogType.Info);
            }
            else if (geometry.type === "point")
            {
                point = geometry;
            }
            else if (geometry.type === "extent")
            {
                point = geometry.getCenter();
            }
            else
            {
                _log("_getPointFromGeometry: Invalid geometry type '" + typeof (geometry) +
                    "'. Point conversion ignored.");
            }

            return point;
        }

        function _bulkTranslateRCsAsync(STR_RC_KEYS_ARRAY)
        {
            var bulkTranslateApiUrl = _webApiUrl + "/" + "BulkTranslateRCs";

            return _execAjaxRequestAsync(bulkTranslateApiUrl, "json",
                JSON.stringify(STR_RC_KEYS_ARRAY), "application/json");
        }

        function _logExceptionMessageAsync(message)
        {
            var logExceptionUrl = _webApiUrl + "/" + "LogExceptionMessage";
            var cleanMsg = JSON.stringify(escape(message));

            return _execAjaxRequestAsync(logExceptionUrl, "text",
                cleanMsg, "application/json");
        }

        function _setStringsAndGetHasSessionAsync()
        {
            return _setPrivateStringsAsync()
                .then(_hasSessionAsync);
        }

        function _hasSessionAsync()
        {
            var hasSessionUrl = _webApiUrl + "/" + "HasSession";
            return _execAjaxRequestAsync(hasSessionUrl, "text")
                .then(function(data)
                {
                    return data.indexOf("true") === 0;
                });
        }

        function _requireApiLoginAsync()
        {
            var requireAPILoginUrl = _webApiUrl + "/" + "RequireAPILogin";
            return _execAjaxRequestAsync(requireAPILoginUrl, "text")
                .then(function(data)
                {
                    return data.indexOf("true") === 0;
                });
        }

        function _requiresSessionAsync()
        {
            var jqDeferred = $.Deferred();

            if (_requireApiLogin === null)
            {
                _requireApiLoginAsync()
                .then(function(data)
                {
                    _requireApiLogin = data;
                    
                    _log("_requiresSessionAsync: Require API login: " +
                        _requireApiLogin);
                    

                    if (_requireApiLogin)
                    {
                        _setStringsAndGetHasSessionAsync()
                        .then(function(hasSession)
                        {
                            jqDeferred.resolve(!hasSession);
                        });
                    }
                    else
                    {
                        jqDeferred.resolve(false);
                    }
                });
            }
            else
            {
                if (_requireApiLogin)
                {
                    _setStringsAndGetHasSessionAsync()
                    .then(function(hasSession)
                    {
                        jqDeferred.resolve(!hasSession);
                    });
                }
                else
                {
                    jqDeferred.resolve(false);
                }
            }
            return jqDeferred;
        }

        function _disconnectSessionAsync()
        {
            var jqDeferred = $.Deferred();
            var disconnectSession = _webApiUrl + "/" + "DisconnectSession";

            _execAjaxRequestAsync(disconnectSession, "text",
            null, null, "POST")
            .then(function(data, textStatus, jqXHR)
            {
                if (data.indexOf("true") === 0)
                {
                    _showRefreshHtml(_loggedOutHtml);
                    
                    _log("_disconnectSessionAsync: Session disconnected.");
                    
                    jqDeferred.resolve();
                }
                else
                {
                    jqDeferred.reject("Error receiving disconnect confirmation from server.");
                }
            });
            return jqDeferred;
        }

        function _getRequiredHitListScriptsAsync()
        {
            var jqDeferred = $.Deferred();
            var getRequiredHitListScripts = _webApiUrl + "/" + "GetRequiredHitListScripts";

            if (!_requiredHitListScripts)
            {
                _execAjaxRequestAsync(getRequiredHitListScripts, "json")
                .then(function(data, textStatus, jqXHR)
                {
                    _requiredHitListScripts = data;
                    for (var i = 0; i < _requiredHitListScripts.length; i++)
                    {
                        _appendScript(_requiredHitListScripts[i]);
                    }
                    jqDeferred.resolve();
                });
            }
            else
            {
                for (var i = 0; i < _requiredHitListScripts.length; i++)
                {
                    _appendScript(_requiredHitListScripts[i]);
                }
                jqDeferred.resolve();
            }
            return jqDeferred;
        }

        function _getRequiredHitListCssAsync()
        {
            var jqDeferred = $.Deferred();
            var getRequiredHitListCSS = _webApiUrl + "/" + "GetRequiredHitListCSS";

            if (!_requiredHitListCSS)
            {
                _execAjaxRequestAsync(getRequiredHitListCSS, "json")
                .then(function(data, textStatus, jqXHR)
                {
                    _requiredHitListCSS = data;
                    for (var i = 0; i < _requiredHitListCSS.length; i++)
                    {
                        _appendStyle(_requiredHitListCSS[i]);
                    }
                    jqDeferred.resolve();

                });
            }
            else
            {
                for (var i = 0; i < _requiredHitListCSS.length; i++)
                {
                    _appendStyle(_requiredHitListCSS[i]);
                }
                jqDeferred.resolve();
            }
            return jqDeferred;
        }

        function _getWidgetViewHtmlAsync()
        {
            var jqDeferred = $.Deferred();
            var getWidgetViewUrl = _webApiUrl + "/" + "GetWidgetViewHtml";
            // Widget styling is stored in the css file for the hitlist.

            _execAjaxRequestAsync(getWidgetViewUrl, 'html')
            .then(function(html)
            {
                jqDeferred.resolve(html);
            });

            return jqDeferred;
        }

        //Now used by the Geocortex integration! Any changes to this result in
        // needing to test/consider the Geocortex widget!
        function _createWidgetAsync(map, OBWidgetViewModel, widgetConfig)
        {
            var jqDeferred = $.Deferred();
            var viewModel = null;
            _setUpUIPrerequisites()
            .then(function()
            {
                _getWidgetViewHtmlAsync()
                .then(function(html)
                {
                    var options =
                    {
                        map: map,
                        obApi: _instance,
                        queryArcGISDynamicMapServiceLayers: widgetConfig.QueryArcGISDynamicMapServiceLayers,
                        addDynamicSelectionToMap: widgetConfig.AddDynamicSelectionToMap,
                        useOBHighlighting: widgetConfig.ShouldUseHighlightingOverride,
                        selFillColor: widgetConfig.SelectionFillColor,
                        selOutlineColor: widgetConfig.SelectionOutlineColor,
                        toolFillColor: widgetConfig.ToolFillColor,
                        toolOutlineColor: widgetConfig.ToolOutlineColor,
                        selectionType: widgetConfig.SelectionType,
                        debugMode: widgetConfig.ConsoleLogging,
                        identifyQueryTolerance: widgetConfig.IdentifyQueryTolerance,
                        disableInfoWindowInDrawMode: widgetConfig.DisableInfoWindowInDrawMode,
                        queryDistance: widgetConfig.PointAndLineTolerance,
                        cityworksProxyObj: widgetConfig.cityworksProxyObj || null
                    };

                    //create new view model
                    viewModel = new OBWidgetViewModel(options);
                    //wire up the UI
                    viewModel.wireUpUI(html, widgetConfig);

                    jqDeferred.resolve(viewModel);

                });
            });
            return jqDeferred;
        }

        function _getConfiguredLayerId(layerName)
        {
            var layerId = -1;

            if (_obConfiguredLayers !== null)
            {
                for (var l = 0; l < _obConfiguredLayers.length; l++)
                {
                    var cfgNameLower = _obConfiguredLayers[l].Name.toLowerCase();
                    var layerNameLower = layerName.toLowerCase();

                    if (cfgNameLower === layerNameLower)
                    {
                        layerId = _obConfiguredLayers[l].Id;
                        break;
                    }
                }
            }
            else
            {
                _log("_getConfiguredLayerId: Warning: ob configured layers have not been retrieved from the server.", EnumLogType.Warn);
            }
            return layerId;
        }

        //TODO: Currently must always use field aliases as that is what gis cfg uses
        function _createObFeature(esriGraphicAttributes, shouldUseAlias, esriFields)
        {
            var obFeaturePropertiesArray = [];

            for (var prop in esriGraphicAttributes)
            {
                featureProperties = {};
                featureProperties.Key = shouldUseAlias ? _findFieldAlias(esriFields, prop) : prop;
                featureProperties.Value = esriGraphicAttributes[prop];

                obFeaturePropertiesArray.push(featureProperties);
            }

            var feature = {};
            feature.FeatureProperties = obFeaturePropertiesArray;

            return feature;
        }

        function _createObLayer(layerName, featuresArray, isCheckLayer)
        {
            var layerId = _getConfiguredLayerId(layerName);

            var _selectedFeaturesLayer = null;

            if (layerId === -1 && isCheckLayer !== undefined && isCheckLayer === true)
            {
                
                _log("_createObLayer: Layer name '" + layerName + "' not found in configured layers.");
                
            }
            else
            {
                _selectedFeaturesLayer = new _SelectedFeaturesLayer(layerId, layerName, featuresArray);
            }

            return _selectedFeaturesLayer;
        }

        function _SelectedFeaturesLayer(layerId, layerName, features)
        {
            this.LayerId = layerId;
            this.LayerName = layerName;
            //An array of SelectedFeature objects
            this.Features = features;
        }

        function _convertEsriFeatures(results, layerIds)
        {
            var obSelectedFeatureLayers = [];
            //Create the featureLayers
            for (var i = 0, iLen = layerIds.length; i < iLen; i++)
            {
                var obFeaturesArray = [];
                var currentLayerName = "";

                for (var j = 0, jLen = results.length; j < jLen; j++)
                {
                    var identifyResult = results[j];
                    var currentLayerId = -1;
                    var isLayerPropMode = false;

                    if (identifyResult.layerId !== undefined)
                    {
                        currentLayerId = identifyResult.layerId;
                    }
                    else
                    {
                        currentLayerId = identifyResult._layer.layerId;
                        isLayerPropMode = true;
                    }

                    if (currentLayerId === layerIds[i])
                    {
                        var feature = identifyResult.feature;

                        if (currentLayerName === "")
                        {
                            if (!isLayerPropMode)
                            {
                                currentLayerName = identifyResult.layerName;
                            }
                            else
                            {
                                currentLayerName = identifyResult._layer.name;
                            }
                        }

                        //Create the OB feature and add to the feature array
                        var obFeature = null;
                        if (isLayerPropMode)
                        {
                            obFeature = _createObFeature(identifyResult.attributes);
                        }
                        else 
                        {
                            obFeature = _createObFeature(feature.attributes);
                        }
                        obFeaturesArray.push(obFeature);
                    }
                }

                if (currentLayerName !== "")
                {
                    //Add all the features for this layer
                    var obSelectedFeaturelayer = _createObLayer(currentLayerName, obFeaturesArray, true);

                    //This will be null if the layerName was not configured. See console.log errors
                    if (obSelectedFeaturelayer !== null)
                    {
                        obSelectedFeatureLayers.push(obSelectedFeaturelayer);
                    }
                }
            }

            return obSelectedFeatureLayers;
        }

        function _getObLayersFromIdentifyOrQueryAsync(featureLayers, graphicsArrays)
        {
            return _getConfiguredLayersAsync().then(function()
            {
                var obLayers = [];

                //Outside developers may pass us invalid input, so we wrap it in a try/catch.
                try
                {
                    //Roughly check parameters for valid input data
                    var isValidInputData = featureLayers && featureLayers.length && graphicsArrays && graphicsArrays.length;

                    if (isValidInputData)
                    {
                        //For each layer
                        for (var i = 0, iLen = graphicsArrays.length; i < iLen; i++)
                        {
                            var graphicsArray = graphicsArrays[i];

                            //Using Identify or Query, it is possible to receive layers (graphicsArrays) with 0 features.
                            if (graphicsArray && graphicsArray.length)
                            {
                                var currentLayer = featureLayers[i];
                                var obFeaturesArray = [];

                                //For each graphic in this layer
                                for (var j = 0, jLen = graphicsArray.length; j < jLen; j++)
                                {
                                    var graphic = graphicsArray[j];

                                    var featureAttributes = graphic.attributes;

                                    //Create the OB feature and add to the feature array
                                    var obFeature = _createObFeature(featureAttributes, true, currentLayer.fields);
                                    obFeaturesArray.push(obFeature);
                                }

                                //Returns a new feature layer, or null if not mapped in gis configuration
                                var obLayer = _createObLayer(currentLayer.name, obFeaturesArray, true);

                                if (obLayer)
                                {
                                    obLayers.push(obLayer);
                                }
                                else
                                {
                                    _log("_getObLayersFromIdentifyOrQueryAsync: data could not be converted to an OnBase layer. FeatureLayer: " +
                                        currentLayer.name, EnumLogType.Warn);
                                }
                            }
                        }
                    }
                }
                catch (ex)
                {
                    _log("_getObLayersFromIdentifyOrQueryAsync: error converting data from identify or query operation. " +
                        "Ensure valid data is being passed in. " + ex.message, EnumLogType.Error);
                }

                if (obLayers.length === 0)
                {
                    _log("_getObLayersFromIdentifyOrQueryAsync: None of the layers passed in were able to be converted to OnBase layers.",
                        EnumLogType.Warn);
                }

                return obLayers;
            });
        }

        function _isConfiguredLayerId(layerName)
        {
            var hasLayerName = false;
            if (_getConfiguredLayerId(layerName) !== -1)
            {
                hasLayerName = true;
            }
            return hasLayerName;
        }

        // inject scripts and css
        function _setUpUIPrerequisites()
        {
            return _getRequiredHitListScriptsAsync()
                 .then(_getRequiredHitListCssAsync)
                 .then(_setPrivateStringsAsync);
        }

        function _setPrivateStringsAsync()
        {
            var jqDeferred = $.Deferred();
            if (_STR_RC_GIS_LOGIN_REFRESH === "")
            {
                _bulkTranslateRCsAsync([
                    "STR_RC_GIS_LOGIN_REFRESH",
                    "STR_RC_GIS_LOGIN_TRYAGAIN",
                    "STR_RC_REFRESH",
                    "STR_RC_GIS_HITLIST_LOGGINGIN",
                    "STR_RC_GIS_SELECTFEATURES",
                    "STR_RC_GIS_CLEARSELECTEDFEATS",
                    "STR_RC_GIS_RESPONSE_ERROR",
                    "STR_RC_GIS_CLOSE"])
                .then(function(strings)
                {
                    _STR_RC_GIS_LOGIN_REFRESH = strings[0];
                    _STR_RC_GIS_LOGIN_TRYAGAIN = strings[1];
                    _STR_RC_REFRESH = strings[2];
                    _STR_RC_GIS_HITLIST_LOGGINGIN = strings[3];
                    _STR_RC_GIS_SELECTFEATURES = strings[4];
                    _STR_RC_GIS_CLEARSELECTEDFEATS = strings[5];
                    _STR_RC_GIS_RESPONSE_ERROR = strings[6];
                    _STR_RC_GIS_CLOSE = strings[7];

                    _setRefreshResultsHtml();
                    jqDeferred.resolve();
                });
            }
            else
            {
                jqDeferred.resolve();
            }
            return jqDeferred;
        }

        function _handle401()
        {
            var loginPageUrl = _rootUrl + _loginPage + "?apimode=true";
            var width = 800;
            var height = 600;
            var loginWindowName = "OB_LoginWindow";
            
            //We don't have a session and we require one, so wipe out old cache
            _obConfiguredLayers = null;
            _log("_handle401: cleared ob configured layers client cache.");

            var win = null;
            //Is there a login window already opened?
            if (_openedLoginWindow !== null)
            {
                try
                {
                    if (_openedLoginWindow.closed)
                    {
                        _openedLoginWindow = null;
                        win = _openWindow(loginPageUrl, loginWindowName, width, height);
                        _openedLoginWindow = win;
                    }
                    else
                    {
                        _openedLoginWindow.focus();
                    }
                }
                catch (e)
                {
                    _log("_handle401: Error accessing login window : " + e.message,
                        EnumLogType.Error);
                }
            }
            else
            {
                win = _openWindow(loginPageUrl, loginWindowName, width, height);
                _openedLoginWindow = win;
            }
            
        }

        function _setRefreshResultsHtml()
        {
            if (_isIncludeRefreshButton)
            {
                _refreshResultsHtml = "<div id='divObDocsRefresh'><p>" +
									  _STR_RC_GIS_LOGIN_TRYAGAIN +
									  "</p><button type='button' class='ob-text-btn' onclick='javascript:OnBaseWebApi.currentInstance().refreshHtmlAsync(true);'>" +
									  _STR_RC_REFRESH + "</button></div>";

                _loggedOutHtml = "<div id='divObDocsRefresh'><p>" +
								 _STR_RC_GIS_LOGIN_REFRESH +
								 "</p><button type='button' class='ob-text-btn' onclick='javascript:OnBaseWebApi.currentInstance().refreshHtmlAsync(true);'>" +
								 _STR_RC_REFRESH + "</button></div>";
            }
            else
            {
                _refreshResultsHtml = "<div id='divObDocsRefresh'><p>" +
									  _STR_RC_GIS_LOGIN_TRYAGAIN + "</p></div>";

                _loggedOutHtml = "<div id='divObDocsRefresh'><p>" +
								 _STR_RC_GIS_LOGIN_REFRESH + "</p></div>";
            }
        }

        function _showRefreshHtml(html)
        {
            if ($("#OB_MainDiv").length > 0)
            {
                $("#OB_MainDiv").html(html);
            }
        }

        function _showRefreshedHitListHtml(html)
        {
            var ob_MainDiv = $("#OB_MainDiv");

            if (ob_MainDiv)
            {
                var parentContainer = ob_MainDiv.parent();

                if (parentContainer)
                {
                    // remove OB_MainDiv. jQuery remove erases data and event handlers as well.
                    ob_MainDiv.remove();

                    parentContainer.html(html);
                }   
            }
        }

        function _openWindow(url, name, w, h)
        {

            wleft = (screen.width - w) / 2;
            wtop = (screen.height - h) / 2;

            if (wleft < 0)
            {
                // w = screen.width;
                wleft = 0;
            }
            if (wtop < 0)
            {
                // h = screen.height;
                wtop = 0;
            }
            var params = 'width=' + w + ', height=' + h + ', ' +
           'left=' + wleft + ', top=' + wtop + ', ' +
           'location=no, menubar=no, ' +
           'status=yes, toolbar=no, scrollbars=yes, resizable=yes';

            var win = window.open(url, name, params);

            //For non IE browsers set resize and moveto
            //Deprecated in Jquery 1.3 and removed in 1.9 (use Modernizr)
            //if (!$.browser.msie)
            //{
            //win.resizeTo(w, h);
            //win.moveTo(wleft, wtop);
            //}
            win.focus();

            return win;
        }

        function _appendScript(filepath)
        {
            var isJQuery = filepath.toLowerCase().indexOf("jquery") !== -1;//Regex would be better
            var isJQueryUI = filepath.toLowerCase().indexOf("jquery-ui") !== -1;
            var isOKToAdd = true;

            if (isJQuery && window.jQuery && !isJQueryUI)
            {
                isOKToAdd = false;
            }
            else if (isJQueryUI && typeof jQuery.ui !== 'undefined' &&
                typeof jQuery.ui.dialog !== 'undefined')
            {
                isOKToAdd = false;

                if(jQuery.dialog == 'undefined')
                {
                    _log("_appendScript: Missing Jquery Dialog in Jquery UI. Errors may occur.", EnumLogType.Warn);
                }
            }
            
            //if ($('head script[src="' + filepath + '"]').length > 0)
            //    isOKToAdd = false;

            //Check all script tags (not just the header)
            var scripts = document.getElementsByTagName('script');
            for (var i = scripts.length; i--;)
            {
                if (scripts[i].src.toLowerCase() === filepath.toLowerCase())
                {
                    isOKToAdd = false;
                    break;
                }
            }

            if (isOKToAdd)
            {
                var elm = document.createElement('script');
                elm.setAttribute("type", "text/javascript");
                elm.setAttribute("src", filepath);
                
                //script eval can cause this to fail if the script is bad
                //or some odd timing issue, so account for it...
                try
                {
                    $('head').append(elm);
                }
                catch(e)
                {
                    _log("_appendScript: Failed to add script: " + filepath + " error: " + e.message,
                        EnumLogType.Error);
                }
            }
        }

        function _appendStyle(filepath)
        {
            if ($('head link[href="' + filepath + '"]').length > 0)
                return;

            var ele = document.createElement('link');
            ele.setAttribute("type", "text/css");
            ele.setAttribute("rel", "Stylesheet");
            ele.setAttribute("href", filepath);
            $('head').append(ele);
        }

        function _findFieldAlias(fields, name)
        {
            var fieldAlias = name;

            for (var i = 0; i < fields.length; i++)
            {
                var field = fields[i];
                if (field.name === name)
                {
                    fieldAlias = field.alias;
                    break;
                }
            }

            return fieldAlias;
        }

        function _getFailCallback(inputErrMsg, isAjaxCall)
        {
            // Note that fail/catch 
            // callbacks do not handle thrown exceptions. 
            // They handle rejection values only.
            var failCallback = function (callbackError)
            {
                if (console)
                {
                    //Do not check debug mode. We always want to display this.
                    console.error(inputErrMsg + " " + callbackError);
                }
            };
            if (isAjaxCall)
            {
                //Ajax fail expects a method and will populate the params and call func
                failCallback = function (jqXhr, textStatus, errorThrown)
                {
                    if (console)
                    {
                        errText = "[errthrown:] " + errorThrown +
                            " [status:] " + textStatus;

                        if (jqXhr.responseText)
                        {
                            errText += " [responseTxt:] " + jqXhr.responseText;
                        }
                        //Do not check debug mode. We always want to display this.
                        console.error(inputErrMsg + " " + errText);
                    }
                };
            }

            return failCallback;
        }

        // See EnumLogType enum.
        function _log(msg, type, prefix)
        {
            if (_isLogConsoleDebugMode && console)
            {
                var pfx = prefix ? "[debug] " + prefix :  "[debug] OBWebAPI: ";

                switch (type)
                {
                    case EnumLogType.Error:
                        console.error(pfx + msg);
                        console.trace();
                        break;
                    case EnumLogType.Info:
                        console.info(pfx + msg);
                        break;
                    case EnumLogType.Verbose:
                        console.info(pfx + msg);
                        console.trace();
                        break;
                    case EnumLogType.Warn:
                        console.warn(pfx + msg);
                        break;
                    default:
                        console.log(pfx + msg);
                        break;
                }
            }
            else if (type === EnumLogType.Error && console)
            {
                var pfx = prefix ? prefix : "OB_WebAPI: ";
                console.error(pfx + msg);
                console.trace();
            }
        }

        /*
         * Get the AbsolutePath for the GISWebAPI.
         * The absolute path includes everything EXCEPT
         * the protocol (schema), host (including port), and any query string.
         * Given example Uri: http://www.contoso.com/catalog/shownew.htm?date=today
         * Returns result: "/catalog/shownew.htm"
         * @returns {string} The absolute path as a string.
         */
        function _getAbsolutePath()
        {
            return _clientConfigOptions.Path;
        }
        /*
         * Create a filter key intelligent enough 
         * to respect different GISWebAPI instances
         * @returns {string} The key used for getting/setting hitlist results filter info.
         */
        function _determineFilterLocalStorageKeyName()
        {
            var localStorageKeyPrefix = "obGisApiFilter_";

            //replace all forward slashes in the path
            var localStorageKeySuffix = _getAbsolutePath().replace(new RegExp("/", "g"), "");

            var keyName = localStorageKeyPrefix + localStorageKeySuffix;

            return keyName;
        }
        //#endregion

        //#region Public Methods
        return {
            /**
             * Create an OnBase feature. OnBase features are needed to create OnBase layers.
             * @version >= OnBase 18.0.
             * @param {Object} esriGraphicAttributes The attributes property from an esri/graphic
             * @param {boolean} shouldUseAlias Whether/not to use field names or field aliases.
             *   Currently, if field aliases differ from the field names, you must set this to true.
             * @param {Object[]} esriFields The esri fields property for the layer the graphic belongs to.
             *   This parameter is required when shouldUseAlias=true
             * @returns {Object} An object that can be used to create an OnBase layer with createObLayer.
             */
            createObFeature: function(esriGraphicAttributes, shouldUseAlias, esriFields)
            {
                return _createObFeature(esriGraphicAttributes, shouldUseAlias, esriFields);
            },
            /**
             * Create a single OnBase layer. An array of OnBase layers
             * can then be used to call retrieveDocumentsHtmlAsync or retrieveDocumentsJsonAsync.
             * @version >= OnBase 18.0.
             * @param {Object[]} onBaseFeaturesArray An array of OnBase features
             *   created from the createObFeature method.
             * @returns {Object} an OnBase layer object with the following properties:
             *     LayerId: The layer's configured layer ID from the OnBase database.
             *     LayerName: The name for the layer as it appears in GIS configuration.
             *     Features: The array of OnBase features passed in.
             */
            createObLayer: function(layerName, onBaseFeaturesArray)
            {
                return _createObLayer(layerName, onBaseFeaturesArray, true);
            },
            /**
             * Convert output from IdentifyTask or QueryTask operations
             * across one or more feature layers into OnBase layers that can
             * be used to obtain a hit list.
             * @version >= OnBase 18.0.
             * @param {FeatureLayer[]} featureLayers An array of esri FeatureLayers, in order,
             *   as they were identified or queried.
             * @param {Object[]} graphicsArrays An array of esri Graphics arrays.
             */
            getObLayersFromIdentifyOrQueryAsync: function(featureLayers, graphicsArrays)
            {
                return _getObLayersFromIdentifyOrQueryAsync(featureLayers, graphicsArrays);
            },
            /**
			 * Check if the esri FeatureLayer ID (string) is
			 * an OnBase-configured layer.
			 * @param {string} layerName The esri FeatureLayer ID.
			 * @returns {boolean} Whether or not the layer is configured in OnBase.
			 */
            isConfiguredLayerId: function(layerName)
            {
                return _isConfiguredLayerId(layerName);
            },
            /**
			 * Get the configured layer objects
			 * which represent OnBase document types and
			 * keywords as they relate to layers and feature attributes.
			 * @param {boolean} [shouldClearClientCache=false] When true, clears any client layers and
			 *  forces a call to server for configured layers.
			 * @param {boolean} [disableLoginPopup=false] Prevent popping the login dialog if no session is held.
			 * @returns {Object} jQuery Deferred. Callback arg will be configured layers.
			 */
            getConfiguredLayersAsync: function(shouldClearClientCache, disableLoginPopup)
            {
                return _getConfiguredLayersAsync(shouldClearClientCache, disableLoginPopup);
            },
            /**
			 * Use this as an alternative to RenderHitListHtml to
			 * obtain the hit list as JSON objects instead of the
			 * HTML hit list control.
			 * @param {Object[]} selectedFeaturesLayers OnBase FeaturesLayers
			 *	created from GetSelectedFeaturesFromEsriLayers.
			 * @returns {Object} jQuery Deferred. Callback arg will be 
			 *  a hit list of feature-associated documents as JSON objects.
			 */
            retrieveDocumentsJsonAsync: function(selectedFeaturesLayers)
            {
                _selectedFeaturesForRefresh = selectedFeaturesLayers;
                var jqDeferred = $.Deferred();

                _requiresSessionAsync()
                .then(function(requiresSession)
                {
                    if (requiresSession)
                    {
                        _handle401();
                    }

                    _retrieveDocumentsJsonAsync(selectedFeaturesLayers)
                    .then(function(jsonDocs)
                    {
                        jqDeferred.resolve(jsonDocs);
                    });
                });

                return jqDeferred;
            },
            /**
			 * Accepts output from an esri/tasks/IdentifyTask and a list
			 * of numeric layerIds and returns the hit list as JSON objects. 
			 * Checks for a user session when requireApiLogin=true in configuration.
			 * @param {Array} identifyResultArray The esri IdentifyResult[] from an IdentifyTask execution.
             * @param {Number[]} layerIds A numeric array of layer IDs to convert. Ex. [0,1,2].
			 * @returns {Object} jQuery Deferred. Callback arg will be 
			 *  a hit list of feature-associated documents as JSON objects.
			 */
            retrieveDocumentsJsonExtAsync: function(identifyResultArray, layerIds)
            {
                _esriResults = identifyResultArray;
                _esriLayerIds = layerIds;
                _selectedFeaturesForRefresh = null; //reset cache
                var jqDeferred = $.Deferred();

                _requiresSessionAsync()
                .then(function(requiresSession)
                {
                    if (requiresSession)
                    {
                        _handle401();
                    }
                    else
                    {
                        _selectedFeaturesForRefresh = _convertEsriFeatures(identifyResultArray, layerIds);
                        _retrieveDocumentsJsonAsync(_selectedFeaturesForRefresh)
                        .then(function(jsonDocs)
                        {
                            jqDeferred.resolve(jsonDocs);
                        });
                    }
                });

                return jqDeferred;
            },
            /**
			 * Get the list of feature-associated documents as
			 * HTML by passing in an array of OnBase FeaturesLayers.
			 * @param {Object[]} selectedFeaturesLayers FeaturesLayers
			 *	created from GetSelectedFeaturesFromEsriLayers.
			 * @returns {Object} jQuery Deferred. Callback arg will be 
			 *  an HTML hitlist of feature-associated documents.
			 */
            retrieveDocumentsHtmlAsync: function(selectedFeaturesLayers)
            {
                var jqDeferred = $.Deferred();
                _selectedFeaturesForRefresh = selectedFeaturesLayers;

                _requiresSessionAsync()
                .then(function(requiresSession)
                {
                    if (requiresSession)
                    {
                        _handle401();

                        jqDeferred.resolve(_refreshResultsHtml);
                    }
                    else
                    {
                        _retrieveDocumentsHtmlAsync(selectedFeaturesLayers)
                        .then(function (retrievedHtml)
                        {
                            jqDeferred.resolve(retrievedHtml);

                        });
                    }

                });

                return jqDeferred;
            },
            /**
			 * Use this method to get a refreshed version of the
			 * obtained HTML hit list from calling RenderHitListHtml.
			 * @param {boolean} isSetHtmlDiv Whether or not to show
			 *	a special refresh HTML message in the container for the hit list.
			 * @returns {Object} jQuery Deferred. Callback arg will be refreshed 
			 *  HTML that was first obtained from RenderHitListHtml.
			 */
            refreshHtmlAsync: function(isSetHtmlDiv)
            {
                var jqDeferred = $.Deferred();

                _requiresSessionAsync()
                .then(function(requiresSession)
                {
                    if (requiresSession)
                    {
                        _handle401();
                        if (isSetHtmlDiv)
                        {
                            _showRefreshHtml(_refreshResultsHtml);
                        }
                        jqDeferred.resolve(_refreshResultsHtml);
                    }
                    else
                    {
                        _getConfiguredLayersAsync()
                        .then(function()
                        {
                            if (_selectedFeaturesForRefresh === null)
                            {
                                _selectedFeaturesForRefresh = _convertEsriFeatures(_esriResults,
                                    _esriLayerIds);
                            }
                            _retrieveDocumentsHtmlAsync(_selectedFeaturesForRefresh)
                            .then(function(html)
                            {
                                if (isSetHtmlDiv)
                                {
                                    _showRefreshedHitListHtml(html);
                                }
                                jqDeferred.resolve(html);
                            });
                        });
                    }
                });

                return jqDeferred;
            },
            /**
			 * Accepts output from an esri/tasks/IdentifyTask and a list
			 * of numeric layerIds and returns the hit list as HTML. 
			 * Checks for a user session when requireApiLogin=true in configuration.
			 * @param {Array} identifyResultArray The esri IdentifyResult[] from an IdentifyTask execution.
             * @param {Number[]} layerIds A numeric array of layer IDs to convert. Ex. [0,1,2].
             * @returns {Object} jQuery Deferred. Callback arg will be 
             *  an HTML hit list of feature-associated documents.
			 */
            retrieveDocumentsHtmlExtAsync: function(identifyResultArray, layerIds)
            {
                _esriResults = identifyResultArray;
                _esriLayerIds = layerIds;
                _selectedFeaturesForRefresh = null; //reset cache
                var jqDeferred = $.Deferred();

                _requiresSessionAsync()
                .then(function(requiresSession)
                {
                    if (requiresSession)
                    {
                        _handle401();
                        jqDeferred.resolve(_refreshResultsHtml);
                    }
                    else
                    {
                        _selectedFeaturesForRefresh = _convertEsriFeatures(identifyResultArray, layerIds);
                        _retrieveDocumentsHtmlAsync(_selectedFeaturesForRefresh)
                        .then(function(html)
                        {
                            jqDeferred.resolve(html);
                        });
                    }

                });

                return jqDeferred;
            },
            /**
			 * Get the currently selected OnBase FeaturesLayers.
             * @returns {Object[]} The OnBase selectedFeaturesLayers 
             *	to pass to renderHitListHtmlAsync or renderHitListJsonAsync
             *	for a refreshed document hit list.
			 */
            convertEsriFeatures: function()
            {
                if (_selectedFeaturesForRefresh === null)
                {
                    if (_esriResults !== null)
                    {
                        _selectedFeaturesForRefresh = _convertEsriFeatures(_esriResults, _esriLayerIds);
                    }
                }
                return _selectedFeaturesForRefresh;
            },
            /**
			 * This method is needed to check a user session
			 * prior to calling RenderHitListJson. When using
			 * RenderHitListHtml, the session is automatically checked.
			 * @returns {Object} jQuery Deferred. Callback arg will be boolean.
			 *  When true, this method also prompts the user with
			 *	the login page.
			 */
            requiresSessionAsync: function()
            {
                return _requiresSessionAsync();
            },
            /**
			 * Check for existing session.
			 * @returns {Object} jQuery Deferred. Callback arg will be boolean.
			 */
            hasSessionAsync: function()
            {
                return _hasSessionAsync();
            },
            /**
			 * This method will attempt to disconnect the OnBase session
			 * used when requireApiLogin=true in configuration. It assumes the user was 
			 * prompted to login at some point and the session is still active.
			 * If this is not called, the OnBase session will remain until an
			 * ASP.NET session timeout.
			 * @returns {Object} jQuery Deferred. No callback arguments passed.
			 */
            disconnectSessionAsync: function()
            {
                var jqDeferred = $.Deferred();
                _setStringsAndGetHasSessionAsync()
                .then(function(hasSession)
                {
                    if (hasSession)
                    {
                        _disconnectSessionAsync()
                        .then(function()
                        {
                            jqDeferred.resolve();
                        });
                    }
                    else
                    {
                        jqDeferred.resolve();
                    }
                });
                return jqDeferred;
            },
            /**
			 * Allows you to write exceptions to the Hyland Diagnostics
			 * Console.
			 * @param {string} msg The exception message to log.
			 * @returns {Object} jQuery Deferred. No callback arguments passed.
			 */
            logExceptionMessageAsync: function(msg)
            {
                return _logExceptionMessageAsync(msg);
            },
            /**
             * Synchronous method to log a message
             * to the console, depending on console logging mode settings
             * for this module.
             * @param {string} msg is the message to log
             * @param {string} [optionalEnumLogType] Optional string (JavaScript enum property)
             *   that is exposed on this api @see EnumLogType
             * @param {string} optionalPrefix - optional prefix override
             */
            log: function(msg, optionalEnumLogType, optionalPrefix)
            {
                _log(msg, optionalEnumLogType, optionalPrefix);
            },
            /**
			 * Prompt the user for a session.
			 * @returns {string} An HTML message telling the user to
			 *	hit the refresh button to log in.
			 */
            promptForSession: function()
            {
                _handle401();
                return _refreshResultsHtml; //Assumes you called RequiresSession first
            },
            /**
			 * Converts any currently selected esri features in the array of feature layers
			 * passed in into OnBase FeaturesLayers required by the RenderHitListHtml
			 * or RenderHitListJson method.
			 * @version >= OnBase 16.0.
			 * @param {Array} featureLayers An array of esri Feature Layers.
			 * @returns {Object} jQuery Deferred. Callback arg will be 
			 *  an array of OnBase selectedFeaturesLayers to pass
			 *	to RenderHitListHtml or RenderHitListJson.
			 */
            getObFeaturesFromEsriLayersAsync: function(featureLayers)
            {
                return _getObFeaturesFromEsriLayersAsync(featureLayers);
            },
            /**
             * Generates a widget control in an div/element {JQueryWidgetDivId} that can be used to select features. 
             * By default requires the developer to handle where in the UI this is displayed.
             * By default will attempt to hook a clickable {JQueryWidgetToggleButtonId} to show/hide {JQueryWidgetDivId}
             * Optionally can display the div/element using Jquery UI dialog {ShouldUseJQueryUiDialog}.
             * INTERNAL NOTE: Any changes to this method need to include consideration/testing of Geocortex.
			 * @param {Object} The Esri map object.
			 * @param {Module} OBWidgetViewModel A module of type OBWidgetViewModel.
			 * @param {Object} overrideOptions Optional configuration overrides that supercede the 
			 *  Web.config appSettings configuration options.
			 * @returns {Object} jQuery Deferred. Callback arg will be a widget instance
			 */
            createWidgetAsync: function (map, OBWidgetViewModel, overrideOptions)
            {
                var jqDeferred = $.Deferred();

                //read the original configuration from the server, and replace with overrides passed in
                var widgetConfig = _clientConfigOptions.WidgetConfig;
                if (overrideOptions)
                {
                    $.each(overrideOptions, function(prop, value)
                    {
                        widgetConfig[prop] = value;
                    });
                }

                //Override this, the obapi's debug mode
                //to respect the value from the widget config file instead.
                _isLogConsoleDebugMode = widgetConfig.ConsoleLogging === true ? true : false;

                if ($(widgetConfig.JQueryWidgetDivId).length > 0)
                {
                    _createWidgetAsync(map, OBWidgetViewModel, widgetConfig)
                    .then(function (widgetViewModel)
                    {
                        jqDeferred.resolve(widgetViewModel);
                    });
                }
                else
                {
                    _log("createWidgetAsync: Missing required widget div with id '" +
                        widgetConfig.JQueryWidgetDivId.replace("#", "") +
                        "' see Web.config widget configuration for details.", EnumLogType.Error);

                    jqDeferred.reject("Could not create widget. Missing required html element.");
                }
                
                return jqDeferred;
            },
            bulkTranslateRCsAsync: function(STR_RC_KEYS_ARRAY)
            {
                // Retrieve product name 'OnBase' by passing in
                // ['STR_PRODUCT_NAME']
                return _bulkTranslateRCsAsync(STR_RC_KEYS_ARRAY);
            },
            /*
           * @returns {Object} Client Configuration properties from a deferred promise.
           */
            getClientConfigurationAsync: function()
            {
                var jqDeferred = $.Deferred();

                if (_clientConfigOptions === null)
                {
                    _getClientConfigurationAsync().then(function ()
                    {
                        jqDeferred.resolve(_clientConfigOptions);
                    });
                }
                else
                {
                    jqDeferred.resolve(_clientConfigOptions);
                }

                return jqDeferred;
            },
            /*
             * @returns {Object} Widget action menu state from a deferred promise.
            */
            getGetActionMenuStateAsync: function ()
            {
                var jqDeferred = $.Deferred();

                _getGetActionMenuStateAsync().then(function ()
                {
                    jqDeferred.resolve(_actionMenuState);
                });
              
                return jqDeferred;
            },
            /*
             * @returns {String} the full Api path.
            */
            getWebApiUrl: function()
            {
                return _webApiUrl;
            },
            /*
            * Checks to see if filter data is stored. Assumes getClientConfigurationAsync was called first!
            * @returns {boolean} 
            */
            hasFilterApplied: function ()
            {
                return _hasFilterApplied();
            },
            /*
             * Execute a jQuery AJAX request.
             * @param {string} url
             * @param {string} receivingType
             * @param {Any} [data]
             * @param {string} [sendingType]
             * @param {string} [httpVerb="GET"]
             * @param {boolean} [enableCaching=false]
             * @returns {Object} jQuery Deferred.
             */
            execAjaxRequestAsync: function(url, receivingType, data, sendingType, httpVerb, enableCaching)
            {
                return _execAjaxRequestAsync(url, receivingType, data, sendingType, httpVerb, enableCaching);
            },
            /**
            * Shows-Hides a loading DIV. Assumes you used the view model and-or default html
            * @version >= OnBase 16.0.
            * @param {bool} [isShowLoading] determines if we show-hide progress.
            */
            toggleLoadingSpinner: function(isShowLoading)
            {
                if (isShowLoading)
                {
                    $('#ob_working_div').show();
                }
                else
                {
                    $('#ob_working_div').hide();
                }
            },
            /**
             * Get the last time the hitlist was updated.
             * @returns Date object.
             */
            getLastResultsUpdateTime: function()
            {
                return _lastResultsUpdateTime;
            },
            determineFilterLocalStorageKeyName: function() 
            {
                return _determineFilterLocalStorageKeyName();
            },
            clearObConfiguredLayersCache: function() 
            {
                _obConfiguredLayers = null;
                _log("clearObConfiguredLayersCache: cleared ob configured layers client cache.");
            },
            esriJsVersion: "",
            EnumLogType: EnumLogType
        };
        //#endregion
    };

    return {
        /**
		 * This is the starting point for singleton usage. 
		 * Get the OnBaseWebApi singleton instance if it exists,
		 * or create one if it does not.
		 * @param {string} rootUrl The URL for the OnBase Web Api.
		 * @param {boolean} [bExcludeRefreshButton=true] Exclude the refresh button
		 *	that shows when a login is required.
		 * @param {boolean} [shouldLogConsole=false] Log trace messages to the console.
		 * @returns {Object} jQuery Deferred. Callback arg will be an instance
		 *  of the api with methods for use.
		 */
        getInstanceAsync: function(rootUrl, bExcludeRefreshButton, shouldLogConsole)
        {
            if (!rootUrl)
            {
                throw "rootUrl required";
            }

            function _endsWith(str, suffix)
            {
                return str.indexOf(suffix, str.length - suffix.length) !== -1;
            }

            var jqDeferred = $.Deferred();
            if (_instance === null)
            {
                _instance = init();

                if (_endsWith(rootUrl, "/"))
                {
                    _rootUrl = rootUrl;
                }
                else
                {
                    _rootUrl = rootUrl + "/";
                }

                _webApiUrl = _rootUrl + _apiUrlSubPath;

                if (bExcludeRefreshButton)
                {
                    _isIncludeRefreshButton = false;
                }

                _isLogConsoleDebugMode = shouldLogConsole;

                // the following must be called after _webApiUrl is set
                _instance.getClientConfigurationAsync()
                .then(function()
                {
                    _instance.log("OB_WebAPI.getInstanceAsync: Initialized OB Web API at: " +
                        _webApiUrl);
                    
                    jqDeferred.resolve(_instance);
                });
            }
            else
            {
                jqDeferred.resolve(_instance);
            }


            return jqDeferred;
        },
        /**
        * Resets the instance so that url changes are respected 
        * on getInstanceAsync calls.
        */
        clearInstance: function()
        {
            _instance = null;
        },
        /**
         * Parameterless, synchronous method that can
         * be called after getInstance has
         * been called.
         * @returns {Object} The OnBaseWebApi instance.
         */
        currentInstance: function()
        {
            if (!_instance)
            {
                if (console)
                {
                    //Cannot use private _log method here.
                    console.error("OBWebAPI: You must call getInstance before calling currentInstance");
                }
            }
            return _instance;
        }
    };

})();


//#region dojo AMD Wrapper
if (typeof define != 'undefined')
{
    //Requires Dojo and JQuery
    define(["dojo/_base/declare", "dojo/_base/lang"],
    function(declare, lang)
    {
        /**
		 * OnBaseWebApi AMD module with methods for
		 * esri GIS-OnBase integration purposes. Specify
		 * 'ScriptsDir/OB_WebAPI' in the require function.
		 * @module OB_WebAPI
		 */
        return declare(null, {

            /**
			 * Initialize the OnBaseWebApi using the 
			 * Asynchronous Module Definition (AMD) approach.
			 * @constructor
		     * @param {string} rootUrl The URL for the OnBase Web Api.
			 * @param {boolean} [bExcludeRefreshButton=true] Exclude the refresh button.
			 *	that shows when a login is required.
			 * @param {boolean} [shouldLogConsole=false] Log trace messages to the console.
			 */
            constructor: function(rootUrl, bExcludeRefreshButton, shouldLogConsole)
            {
                this.rootUrl = rootUrl;
                this.bExcludeRefreshButton = bExcludeRefreshButton;
                this.shouldLogConsole = shouldLogConsole;
            },

            /**
             * After instantiation you must call this method
             * which returns an instance of the OnBaseWebApi
             * as the argument to the callback function. 
             * e.g. obApi.getInstanceAsync().then(function(instance){...});
             * @returns {Object} jQuery Deferred.
             */
            getInstanceAsync: function()
            {
                return OnBaseWebApi.getInstanceAsync(this.rootUrl, this.bExcludeRefreshButton,
                    this.shouldLogConsole);
            },
            /**
            * Resets the Ob_WebAPI instance so that a call to getInstanceAsync will 
            * update the params and not use something cached.
            */
            clearInstance: function ()
            {
                OnBaseWebApi.clearInstance();
            }
        });
    });
}
//#endregion


//#region ObGisStorage Components

/*
 * Browser storage enumeration.
 */
var EnumObStorageType =
{
    LOCAL: "local",
    SESSION: "session",
    COOKIE: "cookie"
};

/*
 * ObGisStorage class. Very loosely based on ObStorage.js in the Web Client,
 * with only necessary GIS functionality.
 * 
 * See the public API within for usage.
 */
var ObGisStorage = (function()
{
    //#region private variables
    var _storageObject = null;
    var _registeredProviders = {};
    //#endregion

    function _setStorageType(storageEnumVal)
    {
        switch (storageEnumVal)
        {
            case EnumObStorageType.SESSION:
                _storageObject = _registeredProviders[EnumObStorageType.SESSION];
                break;
            case EnumObStorageType.COOKIE:
                _storageObject = _registeredProviders[EnumObStorageType.COOKIE];
                break;
            default:
                _storageObject = _registeredProviders[EnumObStorageType.LOCAL];
                break;
        }
    }

    function WrappedStorageProvider(storageEnumVal)
    {
        var _privateStorageObject = null;

        if (storageEnumVal === EnumObStorageType.SESSION)
        {
            _privateStorageObject = window.sessionStorage;
        }
        else
        {
            _privateStorageObject = window.localStorage;
        }

        //#region common interface
        return {
            getItem: function(keyString)
            {
                return _privateStorageObject.getItem(keyString);
            },
            setItem: function(keyString, valueString)
            {
                _privateStorageObject.setItem(keyString, valueString);
            },
            removeItem: function(keyString)
            {
                _privateStorageObject.removeItem(keyString);
            }
        };
        //#endregion
    }

    function CookieStorageProvider()
    {
        //#region private helper methods

        /**
         * Delete a browser cookie by name.
         * @param {string} cookieName The name of the cookie.
         * @param {string} [path="/"] Needs to be the path originally set for the cookie.
         *  If not supplied, assumes the path was set as "/".
         * @returns {boolean} Was successful.
         */
        function _deleteCookie(cookieName, path)
        {
            var expiry = new Date("January 01, 1970 00:00:00");
            var cookieString = cookieName + "=; expires=" +
                expiry.toUTCString() + ";";

            if (path)
            {
                cookieString += " path=" + path;
            }
            else
            {
                cookieString += " path=/";
            }

            document.cookie = cookieString;
            //Could provide a success value: return _getRawCookie(cookieName) === null;
        }

        /**
         * Set a cookie in the browser.
         * @param {string} cookieName
         * @param {string} value
         * @param {number} [daysTilExpire] If not set, the cookie has a lifespan of a single browser session.
         * @param {string} [path="/"] Default to the top-most level, meaning
         *  all virtual directories on the server will have access.
         */
        function _setCookie(cookieName, value, daysTilExpire, path)
        {
            var cookieString = cookieName + "=" +
                encodeURIComponent(value) + ";";

            if (daysTilExpire)
            {
                var expiry = new Date();
                var nowInMS = expiry.getTime();
                var numDaysInMS = daysTilExpire * 24 * 60 * 60 * 1000;
                var futureDateInMS = nowInMS + numDaysInMS;

                expiry.setTime(futureDateInMS);

                cookieString += " expires=" + expiry.toUTCString() + ";"
            }

            if (path)
            {
                cookieString += " path=" + path;
            }
            else
            {
                cookieString += " path=/";
            }

            document.cookie = cookieString;
        }

        /**
         * Simply get the value of a browser cookie
         * by its name.
         * @param {string} cookieName The name of the cookie.
         * @returns {string} The value of the cookie, or null
         *  if it cannot be obtained.
         */
        function _getCookieValue(cookieName)
        {
            var cookieValue = null;
            var cookie = _getRawCookie(cookieName);
            if (cookie)
            {
                try
                {
                    // plus 1 for the equals sign after the cookie name
                    cookieValue = decodeURIComponent(cookie.substring(cookieName.length + 1));
                }
                catch (ex)
                {
                    if (console)
                    {
                        console.error("OnBaseByHyland:: getCookieValue error: " +
                            ex.message);
                    }
                }
            }
            return cookieValue;
        }

        /**
         * Get the raw cookie, name and value.
         * @param {string} cookieName The name of the cookie.
         * @returns {string} The entire cookie, name and value,
         *  for the name supplied.
         */
        function _getRawCookie(cookieName)
        {
            var cookieString = document.cookie,
                cookies = null,
                cookie = null;

            if (cookieString && typeof (cookieString) == "string")
            {
                cookies = cookieString.split(";");
                for (var i = 0, len = cookies.length; i < len; i++)
                {
                    var current = cookies[i].trim();
                    if (current.substr(0, cookieName.length) === cookieName)
                    {
                        cookie = current;
                        break;
                    }
                }
            }
            return cookie;
        }
        //#endregion

        //#region common interface
        return {
            getItem: function(keyString)
            {
                return _getCookieValue(keyString);
            },
            setItem: function(keyString, valueString)
            {
                //determine values here to keep the common interface
                var daysTilExpire = null;
                var path = "/";

                _setCookie(keyString, valueString, daysTilExpire, path);
            },
            removeItem: function(keyString)
            {
                //determine path here to keep the common interface
                var path = "/";

                _deleteCookie(keyString, path);
            }
        };
        //#endregion
    }

    //register providers once up front so they aren't created every time
    _registeredProviders[EnumObStorageType.LOCAL] = new WrappedStorageProvider(EnumObStorageType.LOCAL);
    _registeredProviders[EnumObStorageType.SESSION] = new WrappedStorageProvider(EnumObStorageType.SESSION);
    _registeredProviders[EnumObStorageType.COOKIE] = new CookieStorageProvider();

    //public api
    var storageApi =
    {
        /*
         * Get an item from storage based on the key and provider passed in.
         * @param {string} keyString The key or name of the storage item.
         * @param {string} [storageEnumVal=EnumObStorageType.LOCAL] The storage provider.
         * @returns {string} The value of the item.
         */
        getItem: function(keyString, storageEnumVal)
        {
            var inputType = storageEnumVal || EnumObStorageType.LOCAL;
            _setStorageType(inputType);

            return _storageObject.getItem(keyString);
        },
        /*
         * Add an item to storage.
         * @param {string} keyString The key or name of the storage item.
         * @param {string} valueString The value that will be set as type string.
         * @param {string} [storageEnumVal=EnumObStorageType.LOCAL] The storage provider.
         */
        setItem: function(keyString, valueString, storageEnumVal)
        {
            var inputType = storageEnumVal || EnumObStorageType.LOCAL;
            _setStorageType(inputType);

            _storageObject.setItem(keyString, valueString);
        },
        /*
         * Remove an item from storage based on the key and storage type passed in.
         * @param {string} keyString The key or name of the storage item.
         * @param {string} [storageEnumVal=EnumObStorageType.LOCAL] The storage provider.
         */
        removeItem: function(keyString, storageEnumVal)
        {
            var inputType = storageEnumVal || EnumObStorageType.LOCAL;
            _setStorageType(inputType);

            _storageObject.removeItem(keyString);
        }
    };

    return storageApi;

})();
//#endregion