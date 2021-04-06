define(['dojo/_base/declare', 'dojo/on', 'dojo/_base/lang', 'dojo/_base/array', 'dojo/promise/all', 'esri/renderers/SimpleRenderer', 'esri/symbols/SimpleMarkerSymbol', 'esri/symbols/SimpleLineSymbol', 'esri/symbols/SimpleFillSymbol', 'esri/Color', 'esri/layers/FeatureLayer', 'esri/layers/GraphicsLayer', 'esri/tasks/IdentifyTask', 'esri/tasks/IdentifyParameters', 'esri/tasks/QueryTask', 'esri/tasks/query', 'esri/toolbars/draw'
], function(declare, on, lang, arrayUtils, all, SimpleRenderer, SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol, Color, FeatureLayer, GraphicsLayer, IdentifyTask, IdentifyParameters, QueryTask, Query, Draw
)
	{

		// #region Static Vars
		var _vmScope = null;
		var MENU_ID_SUFFIX = "_Menu";
		var DYNAMIC_SELECTED_LAYER_PREFIX = "obDisplayLayer_";

		var EnumLogType =
			{
				Log: "log",
				Error: "error",
				Info: "info",
				Warn: "warn"
			};

		var EnumMenuActionType =
			{
				Attach: "attach",
				Detach: "detach",
				Download: "download",
				Import: "import",
				Filter: "filter",
				Folder: "folder",
				Refresh: "refresh",
				Weblink: "weblink",
				LogoutLoginPrompt: "logoutLoginPrompt",
				Logout: "logout",
				ToggleMenu: "togglemenu",
				CloseWorkflowDialog: "closeWorkflowDialog"
			};

		var EnumMenuActionPageNames =
			{
				LoginClose: "close.aspx",//only called after a successful login
				Filter: "filter.aspx",
				UnKnown: "unknown"
			};
		// #endregion Static Vars

		return declare(null, {

			// #region Public Methods

			/**
			 * Create an instance of the OBWidgetViewModel. The view model listens for selections on
			 * feature layers, and subsequently updates the view with related OnBase results.
			 * @constructs OBWidgetViewModel
			 * @param {Object} options A plain JavaScript Object with specific properties.
			 * @param {Object} options.map The ESRI ArcGIS JS API map instance.
			 * @param {Object} options.obApi The OB GIS Web API instance.
			 * @param {boolean} [options.queryArcGISDynamicMapServiceLayers=false] Include the
			 * ArcGISDynamicMapServiceLayer type in selection and OnBase queries.
			 * @param {boolean} [options.addDynamicSelectionToMap=false] Attempt to add GraphicsLayers to the map for
			 * ArcGISDynamicMapServiceLayer selections.
			 * @param {boolean} [options.useOBHighlighting=false] Attempt to use ArcGIS JS API highlighting.
			 * @param {number[]} [options.selFillColor] The rgba color for selected features.
			 * @param {number[]} [options.selOutlineColor] The rgba color for selected features' outlines.
			 * @param {number[]} [options.toolFillColor] The rgba color for the selection tool.
			 * @param {number[]} [options.toolOutlineColor] The rgba color for the selection tool outline.
			 * @param {string[]} [options.cityworksProxyObj=null] Cityworks Object instance containing a method used for deriving Cityworks
			 *	layer names that match up with configured layers.
			 * @param {string} [options.selectionType="RECTANGLE"] Controls the the type of selector to be used in the map selection.
			 * @param {number} [options.queryDistance=8] Adjustable tolerance from point or line geometries in which features will become selected.
			 * @param {number} [options.identifyQueryTolerance=3] Buffer tolerance when using query or identify modes.
			 * @param {boolean} [options.debugMode=false] Log trace messages to the browser console.
			 * @throws {Error} options.map is required.
			 * @throws {Error} options.obApi is required.
			 */
			constructor: function(options)
			{
				//The view model simply will not work without the following required parameters:
				if (!options.map)
				{
					throw new Error('OBWidgetViewModel:: esri map instance is undefined. Widget view model cannot continue.');
				}
				if (!options.obApi)
				{
					throw new Error('OBWidgetViewModel:: OBWebAPI instance must be instantiated prior to calling Widget view model constructor.');
				}

				_vmScope = this;

				//Action menu vars
				this._OnUnLoadCloseWindowsSet = false;
				this._hasInitialActionMenuItems = false;//avoids another round trip since we have this in the widget config on initialization
				this._hasWiredAttach = false;
				this._hasWiredDetach = false;
				this._hasWiredImport = false;
				this._hasWiredDownload = false;
				this._hasWiredFolder = false;
				this._hasWiredRefresh = false;
				this._hasWiredLogout = false;
				this._hasWiredWeblink = false;
				this._hasWiredFilters = false;
				this._widgetMenuStateCache = null;

				//Prevent this viewModel from automatically updating the hit list after feature selections
				//from foreign selection tools other than its own.
				this._restrictAutoQuerying = true;
				//The sentry variable for tracking inside methods. 
				this._shouldAutoQueryOnBase = !this._restrictAutoQuerying;
				this._bypassConfiguredLayerValidation = false;

				this.STR_PRODUCT_NAME = '';
				this.STR_RC_GIS_CLOSE = '';
				this.STR_RC_GIS_SELECTFEATS = '';
				this.STR_RC_GIS_LOGINSELECTFEATS = '';

				//UI Variables (dealing with widgets that can be created by this view model)
				this.widgetConfig = null;
				this._widgetDivName = "";
				this._widgetShowing = false;
				this._widgetShowingDialogWiredUp = false;
				this._isSelectToolActive = false;
				this._isDeselectToolActive = false;
				this._hasMenuClickOnceWired = false;
				this._currentMenu = null;

				//TODO: These variable names in options object need to match and match casing of the C# object.
				// See OB_WebAPI.js createWidgetAsync method as well- this will eliminate confusion and simplify things.

				//Variables from options passed in
				this._map = options.map;
				this._obApi = options.obApi;
				this._useOBHighlighting = options.useOBHighlighting || false;
				this._cityworksProxyObj = options.cityworksProxyObj || null;
				this._isCityworksMode = this._cityworksProxyObj !== null;
				this._toolFillColor = options.toolFillColor || [246, 239, 229, 0.45];
				this._toolOutlineColor = options.toolOutlineColor || [255, 121, 0];
				this._drawType = this._determineEsriDrawType(options.selectionType);
				this._deselectDrawType = this._determineEsriDrawType(options.selectionType);
				this._queryDistance = options.queryDistance || 3;
				this._disableInfoWindowInDrawMode = options.disableInfoWindowInDrawMode || false;
				this._identifyQueryTolerance = this._getIdentifyQueryTolerance(options.identifyQueryTolerance);
				this._debugMode = options.debugMode || false;

				this._queryArcGISDynamicMapServiceLayers = options.queryArcGISDynamicMapServiceLayers === undefined ? false :
					options.queryArcGISDynamicMapServiceLayers;
				this._addDynamicSelectionToMap = options.addDynamicSelectionToMap === undefined ? false :
					(this._queryArcGISDynamicMapServiceLayers && options.addDynamicSelectionToMap);

				this._pointHighlightSymbol = null;
				this._polygonHighlightSymbol = null;
				this._polylineHighlightSymbol = null;
				this._countSelectionComplete = 0;
				this._selectableLayers = [];
				this._lastDynamicObLayersResult = [];

				this._selectionTool = null;
				this._isDrawToolActive = false;
				this._selectionMethod = FeatureLayer.SELECTION_ADD; //default method

				this._lastobFeatureLayersRetrieveData = null;

				if (this._useOBHighlighting)
				{
					var selFillColor = options.selFillColor || [0, 203, 238, 0.35];
					var selOutlineColor = options.selOutlineColor || [0, 0, 255];

					this.initSelectionSymbols(selFillColor, selOutlineColor);
				}

				//register map event listeners (this includes adding layers and setting layer selection symbols, 
				//must be called after initialization of selection symbols).
				this._wireupListeners();

				_vmScope._obApi.log('viewModel constructor - initialized view model.');
			},

			/**
			 * Wires up the OBWidgetViewModel to the UI. For now, only call using OB_WebAPI.createWidgetAsync
			 * @param {String} html - Assumes you are passing in the widget view html. 
			 * @param {Object} widgetConfiguration - Assumes you are passing in the widget config. See Web.config appSettings for widget.
			 */
			wireUpUI: function(html, widgetConfiguration)
			{
				//TODO: check if widgetConfiguration is null
				_vmScope.widgetConfig = widgetConfiguration;

				_vmScope._setScopeTranslations(widgetConfiguration);

				$(widgetConfiguration.JQueryWidgetDivId).html(html);

				this._widgetDivName = widgetConfiguration.JQueryWidgetDivId;

				if (widgetConfiguration.ShouldUseJQueryUiDialog)
				{
					//Hide the title header
					$("#divObHeader").css("display", "none");
				}
				else
				{
					//#region Title, Close, and ZIndex options

					//Hide the title bar?
					if (!widgetConfiguration.ShouldShowTitle && !widgetConfiguration.ShouldShowClose)
					{
						$("#divObHeader").css("display", "none");
					}
					else
					{
						if (widgetConfiguration.ShouldShowClose)
						{
							$("#ob_closeImg").click(function()
							{
								_vmScope.performCloseWidgetTasks(true);
							});

							if (widgetConfiguration.ShouldShowTitle)
							{
								$("#ob_closeImg").attr("alt", _vmScope.STR_RC_GIS_CLOSE)
									.attr("title", _vmScope.STR_RC_GIS_CLOSE);
							}
						}
						else
						{
							$("#ob_closeImg").css("display", "none");
						}

						if (!widgetConfiguration.ShouldShowTitle)
						{
							//$("#ob_title").hide(); //This causes display issues
							$("#ob_title").html("&nbsp;");//This keeps the span CSS but "removes" the title
						}

						if (widgetConfiguration.WidgetCssZProp)
							$(widgetConfiguration.JQueryWidgetDivId).css("z-index", widgetConfiguration.WidgetCssZProp);
					}
					//#endregion Title, Close, and ZIndex options
				}

				var isToggleWiredUp = false;

				//#region Wire Up Toggle Button for showing the widget div?
				if ($(widgetConfiguration.JQueryWidgetToggleButtonId).length > 0)
				{
					if (widgetConfiguration.ShouldUseJQueryUiDialog)
					{
						var w = widgetConfiguration.DialogWidth;
						var h = widgetConfiguration.DialogHeight;

						var wWidget = 550;
						var hWidget = 400;

						if (w && this._isInt(w))
							wWidget = w;
						if (h && this._isInt(h))
							hWidget = h;

						$(widgetConfiguration.JQueryWidgetToggleButtonId).click(function()
						{
							_vmScope._toggleWidget(wWidget, hWidget);
						});
					}
					else
					{
						$(widgetConfiguration.JQueryWidgetToggleButtonId).click(function()
						{
							$(widgetConfiguration.JQueryWidgetDivId).toggle();
							//Check session the 1st time.
							if (_vmScope._widgetShowingDialogWiredUp === false)
							{
								_vmScope.checkSessionAsync();
							}
							//This gets set in JQuery UI dialog option too, but this code path must do it here.
							_vmScope._widgetShowingDialogWiredUp = true;
						});
					}
					isToggleWiredUp = true;
				}
				else if (widgetConfiguration.ShouldUseJQueryUiDialog)
				{
					_vmScope._obApi.log("viewModel.wireUpUI: Missing JQueryWidgetToggleButtonId with id '" +
						widgetConfiguration.JQueryWidgetToggleButtonId.replace("#", "") +
						"' see Web.config appSettings for the widget, or pass in an override value", EnumLogType.Error);
				}
				//#endregion Wire Up Toggle Button for showing the widget div?

				//#region Select Tools Display

				var isCityworks = _vmScope._isCityworksMode;
				//We do not currently support our entire top toolbar in Cityworks
				if (!widgetConfiguration.ShouldShowTopToolbar || isCityworks)
				{
					$(".js_OB_ShowHideTopToolbar").css("display", "none");
					if (isCityworks)
					{
						_vmScope._obApi.log("viewModel.wireUpUI: widget viewModel is in Cityworks mode, top tools are disabled.",
							EnumLogType.Warn);
					}
				}
				else
				{
					if (widgetConfiguration.ShouldShowGeometryOptions)
					{
						_vmScope._setGeometryOptionsStrings(widgetConfiguration);
					}
					else
					{
						$("#obDeselectTool_DownArrow").css("display", "none");
						$("#obSelectTool_DownArrow").css("display", "none");
					}


					if (!widgetConfiguration.ShouldShowFeatureSelectionTools)
					{
						$(".js_OB_ShowHideSelectAndClearTools").css("display", "none");
					}
					else
					{
						if (!widgetConfiguration.ShouldShowDeselectTool)
						{
							$("#obDeselectTool").css("display", "none");
							$("#obDeselectTool_DownArrow").css("display", "none");
						}
						else
						{
							//#region Deselect Tool

							//since we're using deselect tool, swap the icon for the normal select tool to use one with a green plus sign instead
							$("#ob_selectFeaturesImg").removeClass("ob-toolbar-button-select").addClass("obAddSelectionIcon");

							var STR_RC_GIS_DESELECT = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_DESELECT");
							var STR_RC_GIS_REMOVESELECTION = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_REMOVESELECTION");

							$("#ob_btnDeselectTool").attr("title", STR_RC_GIS_REMOVESELECTION);

							var onDeselectFeatBtn_Click = function()
							{
								if (_vmScope._isDeselectToolActive)
								{
									_vmScope._deactivateDeselectTool();
								}
								else
								{
									_vmScope._activateDeselectTool();
								}
							};

							$("#ob_btnDeselectTool").click(onDeselectFeatBtn_Click);

							// #endregion Deselect Tool
						}

						//#region Select and Clear Tools
						var STR_RC_GIS_SELECTFEATURES = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_SELECTFEATURES");
						var STR_RC_GIS_CLEARSELECTEDFEATS = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_CLEARSELECTEDFEATS");
						var STR_SELECT = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_SELECT");

						$("#ob_selectFeaturesImg").attr("title", STR_RC_GIS_SELECTFEATURES);
						$("#ob_clearSelectionsImg").attr("title", STR_RC_GIS_CLEARSELECTEDFEATS);

						var onSelectFeatBtn_Click = function()
						{
							if (_vmScope._isSelectToolActive)
							{
								_vmScope._deactivateSelectTool();
							}
							else
							{
								_vmScope._activateSelectTool();
							}
						};

						var onClearSelectionBtn_Click = function()
						{
							_vmScope.clearSelection();
						};

						$("#ob_selectFeaturesImg").click(onSelectFeatBtn_Click);
						$("#ob_clearSelectionsImg").click(onClearSelectionBtn_Click);
						//#endregion Select and Clear Tools
					}

					//#region Features Header
					$("#expand_collapse_features").attr("title", _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_TOGGLEVISIBILITY"));
					$("#label_features").text(_vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_FEATURESHEADING"));

					var onExpandCollapseFeatures_Click = function()
					{
						if ($("#expand_collapse_features").hasClass("js-ob-invertArrow"))
						{
							$("#expand_collapse_features").removeClass("js-ob-invertArrow");
							$("#ob_top_toolbar").show();
						}
						else
						{
							$("#expand_collapse_features").addClass("js-ob-invertArrow");
							$("#ob_top_toolbar").hide();
						}
					}

					$("#expand_collapse_features").click(onExpandCollapseFeatures_Click);
					$("#label_features").click(onExpandCollapseFeatures_Click);
					//#endregion Features Header

					if (!widgetConfiguration.ShouldShowRefreshTool)
					{
						$("#obTopRefreshTool").css("display", "none");
					}
					else
					{
						//#region Refresh (top toolbar)
						var STR_RC_REFRESH = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_REFRESH");

						$("#ob_docsRefreshImg").attr("title", STR_RC_REFRESH);

						var onRefreshDocsBtn_Click = function()
						{
							_vmScope.refreshDocumentListAsync();
						};

						$("#ob_docsRefreshImg").click(onRefreshDocsBtn_Click);
						//#endregion Refresh (top toolbar)
					}
				}

				//#endregion Select Tools Display

				_vmScope._enableActionsMenuItems(widgetConfiguration);

				_vmScope._wireUpUiTools(widgetConfiguration);

				if (widgetConfiguration.ShouldLoginOnLoad)
				{
					//Fire this off to stop the loading spinner and prompt a login if need be
					setTimeout(function()
					{
						_vmScope.checkSessionAsync();
					}, 500);
				}
				else if (!isToggleWiredUp)
				{
					_vmScope._displayHtml("<p>" + _vmScope.STR_RC_GIS_SELECTFEATS + "</p>");//stop the progress bar
				}
			},

			changeSelectionMethod: function(featureLayerSelectionMethod)
			{
				_vmScope._selectionMethod = featureLayerSelectionMethod;
			},

			/**
			 * Set whether or not this view model should automatically
			 * update the hit list following layer selection-complete events
			 * from external selection tools.
			 * @param {boolean} shouldRestrict Whether or not viewModel should
			 *  restrict updating the hit list automatically.
			 */
			restrictAutoQueryingForResults: function(shouldRestrict)
			{
				_vmScope._restrictAutoQuerying = shouldRestrict;
				_vmScope._shouldAutoQueryOnBase = !shouldRestrict;
			},

			/**
			 * Set whether or not this view model should skip validating
			 * feature layers as they are added to the map against those in GIS config.
			 * @param {boolean} shouldBypassConfigLayerCheck True to skip validation.
			 */
			setBypassConfigLayerCheck: function(shouldBypassConfigLayerCheck)
			{
				_vmScope._bypassConfiguredLayerValidation = shouldBypassConfigLayerCheck;
			},

			/**
			 * Provides public control over when layer selection-complete
			 * events are listened to, and whether OnBase will be queried 
			 * and the hitlist updated.
			 * @see restrictAutoQueryingForResults
			 * @param {boolean} isEnabled True if OnBase should be queried and the
			 *   hitlist should be updated.
			 */
			setActive: function(isEnabled)
			{
				_vmScope._shouldAutoQueryOnBase = isEnabled;
			},

			/**
			 * Is querying for results currently enabled?
			 * @returns {boolean} True if querying of OnBase is enabled.
			 */
			isActive: function()
			{
				return _vmScope._shouldAutoQueryOnBase;
			},

			/**
			 * Public function to be called upon closing the
			 * widget that prepares the UI for the next
			 * time the widget is shown. Pass in true to also hide
			 * the widget.
			 * @param {boolean} shouldCloseWidget Whether or not this method should 
			 *   hide the widget interface, or instead simply perform cleanup tasks for the next widget showing.
			 */
			performCloseWidgetTasks: function(shouldCloseWidget)
			{
				if (shouldCloseWidget)
				{
					$(_vmScope.widgetConfig.JQueryWidgetDivId).hide();
				}
				_vmScope.clearSelection();
			},

			/**
			 * Function that is to be invoked
			 * at the time of, or be hooked to, 
			 * the Widget's display/show action or
			 * button click. Checks for session and
			 * prompts if necessary.
			 * @returns {Object} jQuery Deferred.
			 */
			checkSessionAsync: function()
			{
				var jqDeferred = $.Deferred();

				this._toggleLoadingSpinner(false);

				this._requiresOnBaseSessionAsync()
					.then(function(requiresSession)
					{
						if (!requiresSession)
						{
							_vmScope._displayHtml("<p>" + _vmScope.STR_RC_GIS_SELECTFEATS + "</p>");
						}
						else
						{
							_vmScope._displayHtml("<p>" + _vmScope.STR_RC_GIS_LOGINSELECTFEATS + "</p>");
						}
						jqDeferred.resolve(requiresSession);
					})
					.fail(function(error)
					{

						_vmScope._obApi.log("viewModel.checkSessionAsync: error checking session " +
							error, EnumLogType.Error);

						jqDeferred.reject(error);
					});
				return jqDeferred;
			},

			/**
			 * Use to initialize OR change the selection
			 * symbols' colors. Should be called only once after creating
			 * the view model.
			 * @param {Number[]} fillColor Numeric RGBA array for fill.
			 * @param {Number[]} outlineColor Numeric RGBA array for outline.
			 */
			initSelectionSymbols: function(fillColor, outlineColor)
			{
				this._pointHighlightSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CIRCLE,
					12, new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color(outlineColor), 2), new Color(fillColor));
				this._polygonHighlightSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
					new SimpleLineSymbol(
						SimpleLineSymbol.STYLE_SOLID,
						new Color(outlineColor), 2), new Color(fillColor));
				this._polylineHighlightSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
					new Color(fillColor), 2);
			},

			/**
			 * Suspend drawing tool capability. (Enables map navigation)
			 */
			deactivateDragSelectTool: function()
			{
				if (_vmScope._selectionTool && _vmScope._isDrawToolActive)
				{
					_vmScope._selectionTool.deactivate();
					_vmScope._isDrawToolActive = false;

					if (_vmScope._disableInfoWindowInDrawMode)
					{
						_vmScope._map.setInfoWindowOnClick(true);
					}
				}
			},

			/**
			 * Activate NON-UI drawing tool capability.
			 */
			initDragSelectTool: function()
			{
				//if we haven't initialized before
				if (!_vmScope._selectionTool)
				{
					_vmScope._selectionTool = new Draw(_vmScope._map);

					var toolFillSymbol = new SimpleFillSymbol(
						SimpleFillSymbol.STYLE_SOLID,
						new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
							new Color(_vmScope._toolOutlineColor), 2), new Color(_vmScope._toolFillColor)
					);
					_vmScope._selectionTool.fillSymbol = toolFillSymbol;
					_vmScope._selectionTool.on("draw-complete", lang.hitch(_vmScope, _vmScope._onDrawComplete));
				}

				//if drag select happened to be active, deactivate so that it respects this new drawing geometry type
				_vmScope.deactivateDragSelectTool();

				var drawType = _vmScope._drawType;
				if (_vmScope._isDeselectToolActive)
				{
					drawType = _vmScope._deselectDrawType;
				}
				_vmScope._selectionTool.activate(drawType);
				_vmScope._isDrawToolActive = true;

				//When draw tool is active, disable showing the map info window on map clicks.
				if (_vmScope._disableInfoWindowInDrawMode)
				{
					_vmScope._map.setInfoWindowOnClick(false);

				}
			},

			/**
			 * Clear selected features and deactivate the
			 * selection tool. (To enable selection tool call
			 * initDragSelectTool.)
			 */
			clearSelection: function()
			{
				//Kill any cached ob layers.
				_vmScope._lastobFeatureLayersRetrieveData = null;

				for (var i = 0, len = _vmScope._selectableLayers.length; i < len; i++)
				{
					_vmScope._selectableLayers[i].clearSelection();
				}

				if (_vmScope._addDynamicSelectionToMap)
				{
					_vmScope._lastDynamicObLayersResult = [];

					var graphicsLayerIds = _vmScope._map.graphicsLayerIds;
					var map = _vmScope._map;
					var currentId;
					var layersToRemove = [];
					//Prefer not to have both loops that follow, but cannot easily loop an array while mutating its contents.
					for (var i = 0, iLen = graphicsLayerIds.length; i < iLen; i++)
					{
						currentId = graphicsLayerIds[i];
						if (OBUtils.stringStartsWith(currentId, DYNAMIC_SELECTED_LAYER_PREFIX, true))
						{
							layersToRemove.push(currentId);
						}
					}

					for (var j = 0, jLen = layersToRemove.length; j < jLen; j++)
					{
						map.removeLayer(map.getLayer(layersToRemove[j]));
					}
				}

				_vmScope._displayHtml("<p>" + _vmScope.STR_RC_GIS_SELECTFEATS + "</p>");

				_vmScope.deactivateDragSelectTool();

				_vmScope._clearActionMenuState();

				if (_vmScope._isSelectToolActive)
				{
					_vmScope._deactivateSelectTool();
				}

				if (_vmScope._isDeselectToolActive)
				{
					_vmScope._deactivateDeselectTool();
				}
			},

			/**
			 * Asks the server for a refreshed
			 * OnBase list of documents.
			 * @returns {Object} jQuery Deferred with no data.
			 */
			refreshDocumentListAsync: function()
			{
				var jqDeferred = $.Deferred();

				// TODO: ignoreSelectableLayersDuringRefresh is a temporary control
				// variable used in Geocortex - remove with completion of scr to use obLayers cache instead of selected features.

				//Check for any cached obFeatureLayersRetrieveData that came to this view model from external sources 
				// (geocortex FSM events, for example).
				//This _lastobFeatureLayersRetrieveData cache gets nulled out upon completing a drawing (see _onDrawComplete).
				if (_vmScope._lastobFeatureLayersRetrieveData !== null || _vmScope.ignoreSelectableLayersDuringRefresh)
				{
					_vmScope.retrieveAndDisplayHtmlFromobFeatureLayersAsync(_vmScope._lastobFeatureLayersRetrieveData)
						.always(function()
						{
							jqDeferred.resolve();
						});
				}
				else
				{
					var getResults = function()
					{
						_vmScope.setActive(true);
						_vmScope._queryOnBase();
						jqDeferred.resolve();
					};

					if (!_vmScope._selectableLayers.length)
					{
						_vmScope.getMapFeatureLayersAsync().then(getResults).fail(function()
						{
							jqDeferred.resolve();
						});
					}
					else
					{
						getResults();
					}
				}

				return jqDeferred;
			},

			/**
			 * Public method to get map feature layers in case this viewModel is used without our UI.
			 * Does 3 important and helpful things:
			 *  -Pops login control via a call to getConfiguredLayersAsync if no session.
			 *  -Caches configured layers so this viewModel can add them in memory.
			 *  -Adds all configured layers from the map in memory.
			 * @returns {Object} jQuery Deferred with no arguments.
			 */
			getMapFeatureLayersAsync: function()
			{
				//return deferred so this method is thenable.
				return _vmScope._obApi.getConfiguredLayersAsync().then(function()
				{
					var graphicsLayerIds = _vmScope._map.graphicsLayerIds;
					var currentLyr = null;

					//being safe here to ensure esri has provided an array...
					if (graphicsLayerIds && graphicsLayerIds.hasOwnProperty("length"))
					{
						for (var i = 0, len = graphicsLayerIds.length; i < len; i++)
						{
							currentLyr = _vmScope._map.getLayer(graphicsLayerIds[i]);
							_vmScope._validateAndAddLayer(currentLyr);
						}
					}

					_vmScope._obApi.log('viewModel.getMapFeatureLayersAsync - [tally]: ' + _vmScope._selectableLayers.length);
				});
			},

			/**
			 * Public access to cache obFeatureLayersRetrieveData, which are then intelligently checked
			 * upon refreshing the list of results, and killed upon making a feature selection.
			 * @see refreshDocumentListAsync and _onDrawComplete for details on how this cache works.
			 * @param {Object[]} obFeatureLayersRetrieveData An array of OnBase layers created through the OB API.
			 */
			cacheObFeatureLayersRetrieveData: function(obFeatureLayersRetrieveData) 
			{
				_vmScope._lastobFeatureLayersRetrieveData = obFeatureLayersRetrieveData;
			},

			/**
			 * Provides ability to pass in OB layers created via the OB API,
			 * and display the HTML in the targeted div in the Widget.
			 * @param {Object[]} obFeatureLayersRetrieveData OnBase feature layer(s) retrieval data created via the OB API.
			 * @returns {Object} jQuery Deferred with no callback arguments.
			 */
			retrieveAndDisplayHtmlFromobFeatureLayersAsync: function(obFeatureLayersRetrieveData)
			{
				var jqDeferred = $.Deferred();
				_vmScope._toggleLoadingSpinner(true);

				_vmScope._getHtmlFromApiAsync(obFeatureLayersRetrieveData)
					.then(_vmScope._displayHtml)
					.always(function()
					{
						_vmScope._toggleLoadingSpinner(false);
						jqDeferred.resolve();
					});


				return jqDeferred;
			},
			//#endregion

			//#region Event Handlers

			_onEsriLayerAdd: function(evtArgs)
			{
				this._obApi.log('viewModel._onEsriLayerAdd: layer received. attempting to add layer...');
				this._validateAndAddLayer(evtArgs.layer);
			},

			_onEsriLayerRemove: function(evtArgs)
			{
				this._obApi.log('viewModel._onEsriLayerRemove: layer received. attempting to remove layer...');
				this._findAndRemoveLayer(evtArgs.layer)
			},

			_onDrawComplete: function(event)
			{
				if (_vmScope._isSelectToolActive || _vmScope._isDeselectToolActive)
				{
					this._obApi.log('viewModel._onDrawComplete: drawing complete. attempting to select features...');

					_vmScope._lastobFeatureLayersRetrieveData = null;

					//Set the gatekeeper/sentry that controls querying OnBase for results.
					_vmScope.setActive(true);

					if (_vmScope._queryArcGISDynamicMapServiceLayers)
					{
						_vmScope._makeDynamicSelection(event.geometry).then(_vmScope._makeFeatureLayerSelection);
					}
					else
					{
						_vmScope._makeFeatureLayerSelection(event.geometry);
					}
				}
			},

			_onSelectionComplete: function(evtArgs)
			{
				_vmScope._countSelectionComplete++;
				_vmScope._obApi.log("viewModel._onSelectionComplete: selection complete times: " + _vmScope._countSelectionComplete);
				if (_vmScope._countSelectionComplete === _vmScope._selectableLayers.length)
				{
					_vmScope._countSelectionComplete = 0;

					_vmScope._obApi.log("viewModel._onSelectionComplete: threshold reached (final selection complete).");

					_vmScope._queryOnBase();
				}

			},

			//#endregion Event Handlers

			//#region Private Helper Methods

			/**
			 * Called by @see _makeDynamicSelection following a drawing completion. Responsible for:
			 *	1.) Accepting the user-drawn geometry.
			 *	2.) Reading all current ArcGISDynamicMapServiceLayers on the map.
			 *	3.) Converting those layers to obLayers as understood by the server.
			 *  4.) Setting the resulting obLayers in memory.
			 * @param {Object} geometryObj The drawn esri Geometry object.
			 * @returns {Object} jQuery Deferred with the obLayers array that it sets in memory.
			 */
			_convertDynamicToObLayersAsync: function(geometryObj)
			{
				var jqDeferred = $.Deferred();

				var processLayers = function()
				{
					var arrayDynamicLayerInfoObjects = [];

					var allLayerIds = _vmScope._map.layerIds;

					var currentId;
					var currentLayer;
					var currentLayerInfos;
					var serviceUrl;
					var visibleIds;
					var targetLayerInfos;
					var currentInfo;
					var layerId;
					var currentLayerName;
					var isGroupLayer;
					var isVisible;

					for (var i = 0, iLen = allLayerIds.length; i < iLen; i++)
					{
						currentId = allLayerIds[i];
						currentLayer = _vmScope._map.getLayer(currentId);

						if (_vmScope._isValidDynamicLayer(currentLayer))
						{
							// layerInfos does contain all layers, regardless of how layers 
							//	are grouped in parent group layers
							currentLayerInfos = currentLayer.layerInfos;
							serviceUrl = currentLayer.url;
							visibleIds = currentLayer.visibleLayers;
							targetLayerInfos = [];

							for (var j = 0, jLen = currentLayerInfos.length; j < jLen; j++)
							{
								currentInfo = currentLayerInfos[j];
								layerId = currentInfo.id;
								currentLayerName = currentInfo.name;
								isGroupLayer = OBUtils.isArray(currentInfo.subLayerIds) && currentInfo.subLayerIds.length > 0;
								isVisible = visibleIds.indexOf(layerId.toString()) !== -1 || visibleIds.indexOf(layerId) !== -1;

								if (!isGroupLayer && isVisible &&
									_vmScope._obApi.isConfiguredLayerId(currentLayerName))
								{
									// add it to those to be queried
									targetLayerInfos.push(currentInfo);
								}
							}

							if (targetLayerInfos.length > 0)
							{
								// We assume we already validated the serviceUrl in our preceding logic.
								arrayDynamicLayerInfoObjects.push({ url: serviceUrl, visibleLayerInfos: targetLayerInfos });
							}
						}
					}

					if (arrayDynamicLayerInfoObjects.length > 0)
					{
						var arrayOfDeferredObjects = _vmScope._doDynamicLayersQueries(geometryObj, arrayDynamicLayerInfoObjects);

						_vmScope._all(arrayOfDeferredObjects).then(function(resolvedObLayers)
						{
							var currentResolvedLayer;

							// Filter out any layers that did not come back. Done easier if we had ES2015...
							var sanitizedObLayers = [];
							for (var i = 0; i < resolvedObLayers.length; i++)
							{
								currentResolvedLayer = resolvedObLayers[i];
								if (currentResolvedLayer)
								{
									sanitizedObLayers.push(currentResolvedLayer);
								}
							}

							// if there are already features selected...
							if (_vmScope._lastDynamicObLayersResult.length > 0)
							{
								_vmScope._mergeDynamicObLayersResults(sanitizedObLayers);
							}
							// otherwise if the intent is to select features (not deselect)...
							else if (_vmScope._isSelectToolActive)
							{
								_vmScope._lastDynamicObLayersResult = sanitizedObLayers;
							}
							jqDeferred.resolve();
						})
						.otherwise(function(err)
						{
							jqDeferred.reject(err);
						});
					}
					else
					{
						var result = [];
						_vmScope._lastDynamicObLayersResult = result;
						jqDeferred.resolve(result);
					}
				};


				_vmScope._obApi.getConfiguredLayersAsync().then(processLayers);


				return jqDeferred;
			},

			/**
			 * Search for an obLayer's in-memory existence by its name.
			 * @param {Object} newObLayer The layer (of type obLayer) to look for
			 *	in the array in-memory
			 * @returns {Object} A data structure with the following properties:
			 *	layerIndex: The location in the existing array, or -1 if no match.
			 *	obLayer: The actual existing layer object match, or null if no match.
			 */
			_findCachedObLayer: function(newObLayer) 
			{
				var existingDynamicObLayersResult = _vmScope._lastDynamicObLayersResult;
				var obLayer = null;
				var existingLayer;
				var layerIndex = -1;
				// search existing layers to see if it already exists...
				for (var i = 0, iLen = existingDynamicObLayersResult.length; i < iLen; i++)
				{
					existingLayer = existingDynamicObLayersResult[i];

					if (newObLayer.LayerName === existingLayer.LayerName)
					{
						obLayer = existingLayer;
						layerIndex = i;
						break;
					}
				}
				return { layerIndex: layerIndex, obLayer: obLayer };
			},

			/**
			 * Find the index of a new feature (from a dynamic layer query)
			 * in an array of existing features.
			 * @param {Object} newFeature The feature to check for existence.
			 * @param {Object[]} existingFeatures The existing features in the matching layer.
			 * @returns {Number} The index of the feature, or -1 if not found.
			 */
			_getMatchingFeatureIndex: function(newFeature, existingFeatures) 
			{
				var newFeatureAsString = JSON.stringify(newFeature);
				var matchedIndex = -1;
				var existingFeature;
				// search existing features to see if it already exists...
				for (var i = 0, iLen = existingFeatures.length; i < iLen; i++)
				{
					existingFeature = existingFeatures[i];
					if (newFeatureAsString === JSON.stringify(existingFeature))
					{
						matchedIndex = i;
						break;
					}
				}
				return matchedIndex;
			},

			/**
			 * Merge a new obLayers result from a dynamic query into any
			 * existing results.
			 * @param {Object[]} newDynamicObLayersResult The array of obLayers to merge
			 * into any existing layers.
			 */
			_mergeDynamicObLayersResults: function(newDynamicObLayersResult) 
			{
				var existingDynamicObLayersResult = _vmScope._lastDynamicObLayersResult;

				var shouldAddFeatures = _vmScope._selectionMethod === FeatureLayer.SELECTION_ADD;

				if (existingDynamicObLayersResult.length > 0)
				{
					var newObLayer;
					var newFeatures;
					var existingLayer;
					var foundLayerResult;
					var existingFeatures;
					var newFeature;
					var matchedIndex;
					// loop the new layers and update the existing layers...
					for (var i = 0, iLen = newDynamicObLayersResult.length; i < iLen; i++)
					{
						newObLayer = newDynamicObLayersResult[i];

						// search existing layers to see if the new layer already exists...
						foundLayerResult = _vmScope._findCachedObLayer(newObLayer);
						existingLayer = foundLayerResult.obLayer;

						if (existingLayer)
						{
							existingFeatures = existingLayer.Features;
							newFeatures = newObLayer.Features;
							// loop the new features and update the existing features...
							for (var j = 0, jLen = newFeatures.length; j < jLen; j++)
							{
								newFeature = newFeatures[j];
								// search existing features to see if the new feature already exists...
								matchedIndex = _vmScope._getMatchingFeatureIndex(newFeature, existingFeatures);

								if (shouldAddFeatures && matchedIndex !== -1)
								{
									existingFeatures[matchedIndex] = newFeature;
								}
								else if (shouldAddFeatures && matchedIndex === -1)
								{
									existingFeatures.push(newFeature);
								}
								else if (!shouldAddFeatures && matchedIndex !== -1)
								{
									existingFeatures.splice(matchedIndex, 1);
									// if we removed all the features, remove the entire layer...
									if (existingFeatures.length === 0)
									{
										existingDynamicObLayersResult.splice(foundLayerResult.layerIndex, 1);
										break;
									}
								}
							}
						}
						else if (shouldAddFeatures)
						{
							existingDynamicObLayersResult.push(newObLayer);
						}
					}
				}
				else if (shouldAddFeatures)
				{
					existingDynamicObLayersResult = newDynamicObLayersResult;
				}
			},

			/**
			 * Concatenate obLayers from FeatureLayer selections and obLayers from
			 * Dynamic layer selections currently held in memory.
			 * @param {Object[]} obLayers The FeatureLayer selection output after it has
			 *	been converted to obLayers.
			 * @returns {Object[]} A single array containing obLayers from FeatureLayer and
			 *	Dynamic layer selections.
			 */
			_combineDynamicAndFeatureLayerResults: function(obLayers) 
			{
				var combinedResults = _vmScope._lastDynamicObLayersResult;
				var temp = [];

				if (OBUtils.isArray(obLayers)) 
				{
					var currentObLayer = null;
					for (var i = 0, iLen = obLayers.length; i < iLen; i++)
					{
						currentObLayer = obLayers[i];

						if (_vmScope._findCachedObLayer(currentObLayer).obLayer === null)
						{
							temp.push(currentObLayer);
						}
					}

					if (temp.length > 0)
					{
						combinedResults = combinedResults.concat(temp);
					}
				}


				return combinedResults;
			},

			/**
			 * Called by @see _makeFeatureLayerSelection after both FeatureLayer and Dynamic layer
			 * selections are completed. Also called after a hit list refresh. Responsible for:
			 *	1.) Converting current selections on FeatureLayers to obLayers.
			 *	2.) Combining the obLayers from step 1 with current in-memory obLayers from Dynamic layers.
			 *	3.) Querying OnBase Web API for html based on the obLayers from step 2.
			 *	4.) Displaying that html in the Widget.
			 */
			_queryOnBase: function() 
			{
				if (_vmScope.isActive())
				{
					//Before doing anything else, relinquish access to call this method. (query OnBase)
					if (_vmScope._restrictAutoQuerying)
					{
						_vmScope.setActive(false);
					}

					this._toggleLoadingSpinner(true);

					_vmScope._obApi.getObFeaturesFromEsriLayersAsync(_vmScope._selectableLayers)
						.then(_vmScope._combineDynamicAndFeatureLayerResults)
						.then(_vmScope._getHtmlFromApiAsync)
						.then(_vmScope._displayHtml)
						.always(function()
						{
							_vmScope._toggleLoadingSpinner(false);
						});
				}
				else
				{
					_vmScope._obApi.log("viewModel._queryOnBaseAsync: querying for results is currently disabled.");
				}
			},

			/**
			 * Called by @see _onDrawComplete, and must be called after
			 * @see _makeDynamicSelection if so configured.
			 * @param {Object} geometryObj The esri Geometry from the drawing completion.
			 */
			_makeFeatureLayerSelection: function(geometryObj)
			{
				var doSelect = function()
				{
					if (_vmScope._selectableLayers.length > 0)
					{
						_vmScope._selectFeatures(geometryObj);
					}
					else
					{
						_vmScope._queryOnBase();
					}
				};

				if (!_vmScope._selectableLayers.length)
				{
					_vmScope.getMapFeatureLayersAsync().then(doSelect);
				}
				else
				{
					doSelect();
				}
			},

			/**
			 * Called by @see _onDrawComplete, and must be called before
			 * @see _makeFeatureLayerSelection Returns the drawn geometry
			 * so it can be passed to the @see _makeFeatureLayerSelection method.
			 * @param {Object} geometryObj The esri Geometry from the drawing completion.
			 * @returns {Object} jQuery Deferred with the same esri Geometry object this method received.
			 */
			_makeDynamicSelection: function(geometryObj)
			{
				var jqDeferred = $.Deferred();

				//Check dynamic service layer type first...
				_vmScope._convertDynamicToObLayersAsync(geometryObj)
					.then(function()
					{
						jqDeferred.resolve(geometryObj);
					})
					.fail(function(err)
					{
						_vmScope._obApi.log("viewModel._onDrawComplete: An error occurred. " + err, EnumLogType.Error);
					});

				return jqDeferred;
			},

			_doDynamicLayersQueries: function(geometryObj, arrayDynamicLayerInfoObjects)
			{
				var arrayOfDeferredObjects = [];

				//Query requires one of the following properties: geometry, text, or where.
				var query = new Query();
				query.distance = _vmScope._identifyQueryTolerance;
				query.geometry = geometryObj;
				query.outFields = ["*"];
				query.returnGeometry = _vmScope._addDynamicSelectionToMap; //Are we displaying selected features to the user?
				query.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;

				var dynamicLayerInfoObj;
				var mapServerUrl;
				var visibleLayerInfos;
				var queryUrl;
				var layerInfo;
				var queryTask;
				var deferredQueryResult;
				for (var i = 0, iLen = arrayDynamicLayerInfoObjects.length; i < iLen; i++)
				{
					dynamicLayerInfoObj = arrayDynamicLayerInfoObjects[i];
					mapServerUrl = dynamicLayerInfoObj.url;
					visibleLayerInfos = dynamicLayerInfoObj.visibleLayerInfos;
					queryUrl = OBUtils.stringEndsWith("/", mapServerUrl, false) ? mapServerUrl : mapServerUrl + "/";

					for (var j = 0, jLen = visibleLayerInfos.length; j < jLen; j++)
					{
						try
						{
							layerInfo = visibleLayerInfos[j];
							queryTask = new QueryTask(queryUrl + layerInfo.id);
							//WARNING: esri framework QueryTask.execute method returns dojo/_base/Deferred
							// which is deprecated. Until they change it to use preferred dojo objects, we are
							// stuck using the deprecated object and methods on it.
							deferredQueryResult = queryTask.execute(query).addCallback(_vmScope._createDynamicLayerQueryCallback(layerInfo.name));
							arrayOfDeferredObjects.push(deferredQueryResult);
						}
						catch (ex)
						{
							_vmScope._obApi.log("viewModel._doDynamicLayersQueries: An error occurred. " + ex.message,
								EnumLogType.Error);
						}

					}
				}

				return arrayOfDeferredObjects;
			},

			_getCenterPoint: function(graphic)
			{
				var point = null;
				var geometryType = graphic.geometry.type;
				if (geometryType === "point")
				{
					point = graphic.geometry; // Point
				}
				else if (geometryType === "polygon" || geometryType === "polyline" || geometryType === "multipoint")
				{
					point = graphic.geometry.getExtent().getCenter(); // returns Point
				}
				else if (geometryType === "extent")
				{
					point = graphic.geometry.getCenter(); // returns Point
				}

				return point;
			},

			_createDynamicLayerQueryCallback: function(layerName)
			{
				var callback = function(featureSet)
				{
					var obLayer = null;

					var newGraphics = featureSet.features;

					if (newGraphics && newGraphics.length > 0)
					{
						//Create ob features and layers
						var fields = featureSet.fields;
						var obFeatures = [];
						var obFeature;
						var newGraphic;
						for (var i = 0, iLen = newGraphics.length; i < iLen; i++)
						{
							newGraphic = newGraphics[i];
							obFeature = _vmScope._obApi.createObFeature(newGraphic.attributes, true, fields);

							obFeatures.push(obFeature);
						}

						if (obFeatures.length > 0)
						{
							obLayer = _vmScope._obApi.createObLayer(layerName, obFeatures);
						}

						// Create GraphicsLayer so the user can see what they selected
						if (_vmScope._addDynamicSelectionToMap)
						{
							var layerId = DYNAMIC_SELECTED_LAYER_PREFIX + layerName;
							var hasLayer = OBUtils.isArray(_vmScope._map.graphicsLayerIds) && _vmScope._map.graphicsLayerIds.indexOf(layerId) !== -1;
							var shouldAddGraphics = _vmScope._selectionMethod === FeatureLayer.SELECTION_ADD;
							if (!hasLayer && shouldAddGraphics)
							{
								var newGraphicsLayer = new GraphicsLayer({
									id: layerId
								});
								var geometryType = featureSet.geometryType;
								var symbol = _vmScope._getSelectionSymbol(geometryType);
								for (var i = 0, iLen = newGraphics.length; i < iLen; i++)
								{
									newGraphicsLayer.add(newGraphics[i]);
								}
								newGraphicsLayer.setRenderer(new SimpleRenderer(symbol));

								_vmScope._map.addLayer(newGraphicsLayer);
							}
							else if (hasLayer)
							{
								// The display layer already exists. We must cycle through and merge the graphics.
								var existingLayer = _vmScope._map.getLayer(layerId);
								var newDisplayGraphic;
								var newCoords;
								var existingGraphic;
								var existingCoords;
								for (var i = 0, iLen = newGraphics.length; i < iLen; i++)
								{
									newDisplayGraphic = newGraphics[i];

									newCoords = _vmScope._getCenterPoint(newDisplayGraphic);

									if (newCoords)
									{
										// It is inefficient to go through (potentially) every
										// graphic for this display layer for every graphic we are adding- but no better
										// way exists. At least we're only going through user selected features.
										for (var j = 0, jLen = existingLayer.graphics.length; j < jLen; j++)
										{
											existingGraphic = existingLayer.graphics[j];
											existingCoords = _vmScope._getCenterPoint(existingGraphic);

											// WARNING: We compare features by their geometric coordinates because no better way exists to compare them for sameness.
											// As a result, we can only display one selected feature (graphic) per unique coordinate-
											// therefore, a true count of features by their display layer is not possible and should not be attempted.
											// This is fairly safe since we are really just creating a visual distinction of what is 'selected' and counts do not matter here.
											if (existingCoords &&
												newCoords.x === existingCoords.x && newCoords.y === existingCoords.y)
											{
												// Normally it would cause an error to continuously loop while mutating an array since the length changes, 
												// but we break out of the loop at the first mutation and start over, so it is ok...
												existingLayer.remove(existingGraphic);
												break; // breaks only innermost loop
											}
										}

										if (shouldAddGraphics)
										{
											existingLayer.add(newDisplayGraphic);
										}
									}
								}
							}
						}
					}

					return obLayer;
				};

				return callback;
			},

			_isValidDynamicLayer: function(testLayer)
			{
				var isValid = false;

				if (testLayer &&
					testLayer.visible &&
					OBUtils.isNotNullOrEmpty(testLayer.url) &&
					testLayer.hasOwnProperty("layerInfos") &&
					OBUtils.isArray(testLayer.layerInfos) &&
					OBUtils.isArray(testLayer.visibleLayers) &&
					testLayer.visibleLayers.length > 0)
				{
					isValid = true;
				}

				return isValid;
			},

			/**
			 * Assumes incoming draw type from config has already been set.
			 */
			_setInitialGeometryUiIcons: function(widgetConfiguration)
			{
				var initialIconClass = "";
				var menuIconClass = "";

				var initialDrawType = _vmScope._drawType;

				switch (initialDrawType)
				{
					case Draw.POINT:
						initialIconClass = "obSelectPoint";
						break;
					case Draw.POLYLINE:
						initialIconClass = "obSelectPolyline";
						break;
					case Draw.FREEHAND_POLYLINE:
						initialIconClass = "obSelectFreehandLine";
						break;
					case Draw.FREEHAND_POLYGON:
						initialIconClass = "obSelectFreehandPoly";
						break;
					case Draw.POLYGON:
						initialIconClass = "obSelectPolygon";
						break;
					case Draw.ELLIPSE:
						initialIconClass = "obSelectEllipse";
						break;
					default:
						initialIconClass = "obSelectRectangle";
						break;
				}

				$("#ob_selectFeaturesImg").addClass(initialIconClass);

				//remove the selected class from the default menu item, and add it to the new one
				$("[data-obRelatedIconClass=obSelectRectangle]").removeClass("obSelected");
				$("[data-obRelatedIconClass=" + initialIconClass + "]").addClass("obSelected");

				if (widgetConfiguration.ShouldShowDeselectTool)
				{
					var initialDeselectIconClass = initialIconClass.replace("Select", "DeSelect");
					$("#ob_btnDeselectTool").addClass(initialDeselectIconClass);
					$("[data-obRelatedIconClass=obDeSelectRectangle]").removeClass("obSelected");
					$("[data-obRelatedIconClass=" + initialDeselectIconClass + "]").addClass("obSelected");
				}
			},

			_wireUpUiTools: function(widgetConfiguration)
			{
				//Right now there are only menus for geometry options,
				//so only wire up (ANY and ALL) menus IF geometry options are on
				if (widgetConfiguration.ShouldShowGeometryOptions)
				{
					//explicitly remove any existing icon classes by name
					$("#ob_selectFeaturesImg").removeClass("ob-toolbar-button-select");
					$("#ob_selectFeaturesImg").removeClass("obAddSelectionIcon");
					$("#ob_btnDeselectTool").removeClass("obSubtractSelectionIcon");

					//set the initial select and deselect icons based on the initial draw type
					_vmScope._setInitialGeometryUiIcons(widgetConfiguration);

					var onToolMenu_MouseLeave = function()
					{
						this.classList.remove("obShow");
					};

					var onHasMenu_Click = function(event)
					{
						var menuId = this.id + MENU_ID_SUFFIX;

						var menu = document.getElementById(menuId);

						var isShowing = menu.classList.contains("obShow");

						if (isShowing)
						{
							menu.classList.remove("obShow");
						}
						else
						{
							// Hide any other menus that may be open
							$(".js-obMenu").removeClass("obShow");

							// Show this menu
							menu.classList.add("obShow");
							_vmScope._currentMenu = menu;

							// Listen for a click outside this menu area and hide the menu.
							event.stopPropagation(); // prevents the following click handler from being immediately executed upon adding it.
							if (!_vmScope._hasMenuClickOnceWired)
							{
								document.addEventListener("click", _vmScope._onGeometryMenuClickOnceOutside);
								_vmScope._hasMenuClickOnceWired = true;
							}
						}
					};


					var onGeometryMenuItem_Click = function()
					{
						var menuItem = $(this);

						//get the new arrow tool icon
						var newIconClass = menuItem.attr("data-obRelatedIconClass");

						var isDeselectIcon = newIconClass.indexOf("obDeSelect") !== -1;
						var toolButton = null;
						if (isDeselectIcon)
						{
							toolButton = $("#ob_btnDeselectTool");
							//set the new deselect geometry type
							_vmScope._deselectDrawType = _vmScope._determineEsriDrawType(menuItem.attr("data-obDrawType"));
						}
						else
						{
							toolButton = $("#ob_selectFeaturesImg");
							//set the new select geometry type
							_vmScope._drawType = _vmScope._determineEsriDrawType(menuItem.attr("data-obDrawType"));
						}

						//remove the old arrow tool icon
						var classList = toolButton[0].classList;
						var currentClassName = "";
						for (var i = 0, len = classList.length; i < len; i++)
						{
							currentClassName = classList[i];
							if (currentClassName.indexOf("obSelect") !== -1 ||
								currentClassName.indexOf("obDeSelect") !== -1)
							{
								classList.remove(currentClassName);
								break;
							}
						}

						//set the new arrow tool icon
						toolButton.addClass(newIconClass);

						//ultimately re-activates drawing with new drawing geometry type
						if (isDeselectIcon)
						{
							_vmScope._activateDeselectTool();
						}
						else
						{
							_vmScope._activateSelectTool();
						}

						//visually select the menu item
						menuItem.siblings().removeClass("obSelected");
						menuItem.addClass("obSelected");
					};

					$(".js-obMenu").mouseleave(onToolMenu_MouseLeave);
					$(".js-obGeomMenuItem").click(onGeometryMenuItem_Click);
					$(".js-obHasMenu").click(onHasMenu_Click);
				}

			},

			_onGeometryMenuClickOnceOutside: function(evt)
			{
				var localMenu = _vmScope._currentMenu;
				// The evt.target represents the top-most element in the DOM tree
				if (localMenu && !localMenu.contains(evt.target))
				{
					$(".js-obMenu").removeClass("obShow");

					// Remove ourself as a listener.
					document.removeEventListener("click", _vmScope._onGeometryMenuClickOnceOutside);
					_vmScope._hasMenuClickOnceWired = false;
				}
			},

			_setGeometryOptionsStrings: function(widgetConfiguration)
			{
				// Note the following aliases (display text used interchangeably with drawing type):
				// POLYLINE           ==  "Line"
				// FREEHAND_POLYLINE  ==  "Freehand Line"
				// FREEHAND_POLYGON   ==  "Lasso"

				var translatedStringObject = widgetConfiguration.TranslatedStrings;
				// We utilize a class selector here to place translated text, because there is more than one geometry menu (select and deselect).
				$(".js-obHasMenu").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SHOWGEOMOPTIONS"));
				$(".js-obTxtRectangle").text(_vmScope._getStrValue(translatedStringObject, "STR_OS_LIFECYCLE_SHAPE_RECTANGLE"));
				$(".js-obTxtEllipse").text(_vmScope._getStrValue(translatedStringObject, "STR_UC_ELLIPSE"));
				$(".js-obTxtPolygon").text(_vmScope._getStrValue(translatedStringObject, "STR_UC_POLYGON"));
				$(".js-obTxtPoint").text(_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_POINT"));
				$(".js-obTxtFreehandPolygon").text(_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_LASSO"));
				$(".js-obTxtFreehandPolyline").text(_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_FREEHANDLINE"));
				$(".js-obTxtPolyline").text(_vmScope._getStrValue(translatedStringObject, "STR_UC_LINE"));

				// Tooltips for geometry menu items Select and Deselect
				$("[data-obDrawType=POINT]").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_POINTTOOLTIP"));
				$("[data-obDrawType=POLYLINE]").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_POLYLINETOOLTIP"));
				$("[data-obDrawType=FREEHAND_POLYLINE]").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_FREEHANDLINETOOLTIP"));
				$("[data-obDrawType=RECTANGLE]").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_RECTANGLETOOLTIP"));
				$("[data-obDrawType=POLYGON]").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_POLYGONTOOLTIP"));
				$("[data-obDrawType=FREEHAND_POLYGON]").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_FREEHANDPOLYTOOLTIP"));
				$("[data-obDrawType=ELLIPSE]").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_ELLIPSETOOLTIP"));
			},

			_enableActionsMenuItems: function(widgetConfiguration)
			{
				if (widgetConfiguration.HitListSettings.IsHitListWorkflowColumn)
				{
					var ob_hidden_divs_closeWorkflow_button_Click = function()
					{
						_vmScope._executeMenuAction(EnumMenuActionType.CloseWorkflowDialog);
					};

					$("#ob_hidden_divs_closeWorkflow_button").on("click", ob_hidden_divs_closeWorkflow_button_Click);
					$("#ob_hidden_divs_closeWorkflow_button").text(_vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_CLOSE"));
				}

				if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenu)
				{
					var actionMenuHiddenClassName = "obActionMenuHidden";

					var ob_actions_div_Click = function()
					{
						_vmScope._executeMenuAction(EnumMenuActionType.ToggleMenu);
					};
					$("#ob_expand_collapse_actions").on("click", ob_actions_div_Click);
					$("#ob_actions_header_label").on("click", ob_actions_div_Click);

					_vmScope._obApi.log('viewModel._enableActionsMenuItems: Action menu enabled.', EnumLogType.Info);

					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuAttach)
					{
						$("#ob_actions_attach").removeClass(actionMenuHiddenClassName);
					}
					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuDetach)
					{
						$("#ob_actions_detach").removeClass(actionMenuHiddenClassName);
					}
					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuDownload)
					{
						$("#ob_actions_sendto").removeClass(actionMenuHiddenClassName);
					}
					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuFilter)
					{
						$("#ob_actions_filter").removeClass(actionMenuHiddenClassName);
					}
					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuFolderLink)
					{
						$("#ob_actions_folder").removeClass(actionMenuHiddenClassName);
					}
					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuImport)
					{
						$("#ob_actions_import").removeClass(actionMenuHiddenClassName);
					}
					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuLogout)
					{
						$("#ob_actions_logout").removeClass(actionMenuHiddenClassName);
					}
					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuRefresh)
					{
						$("#ob_actions_refresh").removeClass(actionMenuHiddenClassName);
					}
					if (widgetConfiguration.WidgetActionMenuOptions.IsShowActionMenuWebLink)
					{
						$("#ob_actions_weblink").removeClass(actionMenuHiddenClassName);
					}

					//This is called after we show/hide action options
					_vmScope._setActionMenuOptionsStrings(widgetConfiguration);

					_vmScope._hasInitialActionMenuItems = true;
				}
				else
				{
					this._obApi.log('viewModel._enableActionsMenuItems: Action menu disabled.', EnumLogType.Info);
				}
			},

			_setActionMenuOptionsStrings: function(widgetConfiguration)
			{
				var translatedStringObject = widgetConfiguration.TranslatedStrings;

				//Set all text labels and anythign else that will not change with widget state
				$("#ob_expand_collapse_actions").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_TOGGLEVISIBILITY"));
				$("#ob_actions_header_label").text(_vmScope._getStrValue(translatedStringObject, "STR_ACTIONS"));

				var STR_RC_GIS_IMPORT = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_IMPORT");
				$("#ob_actions_import_label").attr("title", STR_RC_GIS_IMPORT);
				$("#ob_actions_import_button").attr("title", STR_RC_GIS_IMPORT);
				$("#ob_actions_import_label").text(STR_RC_GIS_IMPORT);

				var STR_RC_GIS_ATTACH = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_ATTACH");
				$("#ob_actions_attach_label").attr("title", STR_RC_GIS_ATTACH);
				$("#ob_actions_attach_button").attr("title", STR_RC_GIS_ATTACH);
				$("#ob_actions_attach_label").text(STR_RC_GIS_ATTACH);

				var STR_RC_GIS_DETACH = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_DETACH");
				$("#ob_actions_detach_label").attr("title", STR_RC_GIS_DETACH);
				$("#ob_actions_detach_button").attr("title", STR_RC_GIS_DETACH);
				$("#ob_actions_detach_label").text(STR_RC_GIS_DETACH);

				var STR_RC_SENDTO = _vmScope._getStrValue(translatedStringObject, "STR_RC_SENDTO");
				$("#ob_actions_sendto_label").attr("title", STR_RC_SENDTO);
				$("#ob_actions_sendto_button").attr("title", STR_RC_SENDTO);
				$("#ob_actions_sendto_label").text(STR_RC_SENDTO);

				var STR_RC_REFRESH = _vmScope._getStrValue(translatedStringObject, "STR_RC_REFRESH");
				$("#ob_actions_refresh_label").attr("title", STR_RC_REFRESH);
				$("#ob_actions_refresh_button").attr("title", STR_RC_REFRESH);
				$("#ob_actions_refresh_label").text(STR_RC_REFRESH);

				$("#ob_actions_filter_label").text(_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SETFILTERS"));
				$("#ob_actions_folder_label").text(_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_FOLDERLINK"));
				$("#ob_actions_weblink_label").text(_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_WEBLINK"));

				var STR_RC_LOGOUT = _vmScope._getStrValue(translatedStringObject, "STR_RC_LOGOUT");
				$("#ob_actions_logout_label").text(STR_RC_LOGOUT);
				$("#div_LoginLogout_Prompt").attr("title", STR_RC_LOGOUT);
				$("#ob_hidden_divs_loginLogout_button").text(STR_RC_LOGOUT);

				$("#div_Workflow_Results").attr("title", _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_VIEWWORKFLOW"));

				$("#ob_hidden_divs_loginLogout_span").text(_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_CLICKLOGOUT"));


				_vmScope._setActionMenuState(widgetConfiguration.WidgetActionMenuState);
			},

			_clearActionMenuState: function()
			{
				_vmScope._obApi.hasSessionAsync().then(function(hasSession)
				{
					if (hasSession)
					{
						try
						{
							var saveSelectedFeaturesUrl = _vmScope._obApi.getWebApiUrl() + "/" + "SaveSelectedFeatures";

							_vmScope._obApi.execAjaxRequestAsync(saveSelectedFeaturesUrl, "text", null, "application/json", "POST")
								.then(_vmScope._getGetActionMenuStateFromApiAsync);
						}
						catch (e)
						{
							_vmScope._obApi.log("viewModel.clearActionMenuState: " + e.message, EnumLogType.Error);
						}
					}
					else
					{
						$("#ob_actions_div").addClass("obActionMenuHidden");
					}
				});
			},

			_setActionMenuState: function(widgetMenuState)
			{
                var translatedStringObject = _vmScope.widgetConfig.TranslatedStrings;

				if (_vmScope._hasInitialActionMenuItems === true || _vmScope._obApi.hasSessionAsync())
				{
                    _vmScope._widgetMenuStateCache = widgetMenuState;

                    OnBaseWebHitListUtils.getInstance(widgetMenuState);

					var actionMenuHiddenClassName = "obActionMenuHidden";
					var isShowActionMenu = false;

					if (widgetMenuState.IsUserLoggedIn)
					{
						isShowActionMenu = true;
						$("#ob_actions_div").removeClass(actionMenuHiddenClassName);
					}
					else
					{
						$("#ob_actions_div").addClass(actionMenuHiddenClassName);
					}

					if (isShowActionMenu)
					{
						var disabledClassName = "disabled";
						var importContainer = $("#ob_actions_import");

						//Import options
						//Extra Permission check needed after session is established
						if (widgetMenuState.HasImportRight && widgetMenuState.HasImportDoctypes &&
							importContainer.hasClass("obActionMenuHidden") === true)
						{
							importContainer.removeClass("obActionMenuHidden");
						}

						if (importContainer.hasClass("obActionMenuHidden") === false)
						{
							var importButton = $("#ob_actions_import_button");
							var importLabel = $("#ob_actions_import_label");
							var toolTip = "";

							if (widgetMenuState.HasSelectedFeaturesForImportDoctypes)
							{
								toolTip = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_IMPORT");
								importButton.attr("title", toolTip);
								importLabel.attr("title", toolTip);

								importButton.removeClass("ob-upload-disabled");
								importButton.addClass("ob-upload");

								importLabel.removeClass(disabledClassName);
								importContainer.removeClass(disabledClassName);

								if (_vmScope._hasWiredImport === false)
								{
									var ob_actions_import_button_Click = function()
									{
										_vmScope._executeMenuAction(EnumMenuActionType.Import);
									};

									importButton.on("click", ob_actions_import_button_Click);

									_vmScope._hasWiredImport = true;
								}
							}
							else
							{
								toolTip = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SELNOTCONFIGUREDIMPORT");

								importButton.attr("title", toolTip);
								importLabel.attr("title", toolTip);

								importButton.removeClass("ob-upload");
								importButton.addClass("ob-upload-disabled");

								importLabel.addClass(disabledClassName);
								importContainer.addClass(disabledClassName);

								importButton.off("click");
								_vmScope._hasWiredImport = false;
							}
						}

						//Attach
						if ($("#ob_actions_attach").hasClass("obActionMenuHidden") === false)
						{
							_vmScope._setFeatureSelectTitle(widgetMenuState, "#ob_actions_attach",
								_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_ATTACH"));

							if (widgetMenuState.FeatureCount > 0)
							{
								$("#ob_actions_attach_button").removeClass("ob-attach-disabled");
								$("#ob_actions_attach_button").addClass("ob-attach");

								$("#ob_actions_attach_label").removeClass(disabledClassName);
								$("#ob_actions_attach").removeClass(disabledClassName);

								if (_vmScope._hasWiredAttach === false)
								{
									var ob_actions_attach_button_Click = function()
									{
										_vmScope._executeMenuAction(EnumMenuActionType.Attach);
									};

									$("#ob_actions_attach_button").on("click", ob_actions_attach_button_Click);
									_vmScope._hasWiredAttach = true;
								}
							}
							else
							{
								$("#ob_actions_attach_button").removeClass("ob-attach");
								$("#ob_actions_attach_button").addClass("ob-attach-disabled");

								$("#ob_actions_attach").addClass(disabledClassName);
								$("#ob_actions_attach_label").addClass(disabledClassName);

								$("#ob_actions_attach_button").off("click");
								_vmScope._hasWiredAttach = false;
							}
						}

						//Detach
						if ($("#ob_actions_detach").hasClass("obActionMenuHidden") === false)
						{
							_vmScope._setFeatureSelectTitle(widgetMenuState, "#ob_actions_detach",
								_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_DETACH"));

							if (widgetMenuState.FeatureCount > 0)
							{
								$("#ob_actions_detach_button").removeClass("ob-detach-disabled");
								$("#ob_actions_detach_button").addClass("ob-detach");

								$("#ob_actions_detach_label").removeClass(disabledClassName);
								$("#ob_actions_detach").removeClass(disabledClassName);

								if (_vmScope._hasWiredDetach === false)
								{
									var ob_actions_detach_button_Click = function()
									{
										_vmScope._executeMenuAction(EnumMenuActionType.Detach);
									};

									$("#ob_actions_detach_button").on("click", ob_actions_detach_button_Click);

									_vmScope._hasWiredDetach = true;
								}
							}
							else
							{
								$("#ob_actions_detach_button").removeClass("ob-detach");
								$("#ob_actions_detach_button").addClass("ob-detach-disabled");

								$("#ob_actions_detach").addClass(disabledClassName);
								$("#ob_actions_detach_label").addClass(disabledClassName);

								$("#ob_actions_detach_button").off("click");
								_vmScope._hasWiredDetach = false;
							}
						}

						//Filter
						if ($("#ob_actions_filter").hasClass("obActionMenuHidden") === false)
						{
							_vmScope._setFeatureSelectTitle(widgetMenuState, "#ob_actions_filter",
								_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SETFILTERS"));

							//Check server side and client side
							if (widgetMenuState.IsFilterActive || _vmScope._obApi.hasFilterApplied())
							{
								var filterActiveMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SETFILTERS_ACTIVE");
								$("#ob_actions_filter_label").attr("title", filterActiveMsg);
								$("#ob_actions_filter_button").attr("title", filterActiveMsg);
								$("#ob_actions_filter_button").addClass("active");
							}
							else
							{
								var filterSetMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SETFILTERS");
								$("#ob_actions_filter_label").attr("title", filterSetMsg);
								$("#ob_actions_filter_button").attr("title", filterSetMsg);
								$("#ob_actions_filter_button").removeClass("active");
							}

							if (widgetMenuState.IsUserLoggedIn)
							{
								$("#ob_actions_filter_label").removeClass(disabledClassName);
								$("#ob_actions_filter").removeClass(disabledClassName);

								if (_vmScope._hasWiredFilters === false)
								{
									var ob_actions_filter_button_Click = function()
									{
										_vmScope._executeMenuAction(EnumMenuActionType.Filter);
									};

									$("#ob_actions_filter_button").on("click", ob_actions_filter_button_Click);
									_vmScope._hasWiredFilters = true;
								}
							}
							else
							{
								$("#ob_actions_filter_label").addClass(disabledClassName);
								$("#ob_actions_filter").addClass(disabledClassName);

								$("#ob_actions_filter_button").off("click");
								_vmScope._hasWiredFilters = false;
							}
						}

						//Send To
						if ($("#ob_actions_sendto").hasClass("obActionMenuHidden") === false)
						{

							if (widgetMenuState.DocumentSendToCount > 0)
							{
								$("#ob_actions_sendto_button").removeClass("ob-downloadzip-disabled");
								$("#ob_actions_sendto_button").addClass("ob-downloadzip");

								var sendToMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_SENDTO");
								$("#ob_actions_sendto_label").attr("title", sendToMsg);
								$("#ob_actions_sendto_button").attr("title", sendToMsg);

								$("#ob_actions_sendto_label").removeClass(disabledClassName);
								$("#ob_actions_sendto").removeClass(disabledClassName);

								if (_vmScope._hasWiredDownload === false)
								{
									var ob_actions_sendto_button_Click = function()
									{
										_vmScope._executeMenuAction(EnumMenuActionType.Download);
									};

									$("#ob_actions_sendto_button").on("click", ob_actions_sendto_button_Click);
									_vmScope._hasWiredDownload = true;
								}
							}
							else
							{
								var sendToMsgZeroCount = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SENDTO_COUNTZERO");
								$("#ob_actions_sendto_label").attr("title", sendToMsgZeroCount);
								$("#ob_actions_sendto_button").attr("title", sendToMsgZeroCount);

								$("#ob_actions_sendto_button").removeClass("ob-downloadzip");
								$("#ob_actions_sendto_button").addClass("ob-downloadzip-disabled");

								$("#ob_actions_sendto").addClass(disabledClassName);
								$("#ob_actions_sendto_label").addClass(disabledClassName);

								$("#ob_actions_sendto_button").off("click");
								_vmScope._hasWiredDownload = false;
							}
						}

						//Folder
						//Extra permission check after session is established
						if (widgetMenuState.HasFolderRight && $("#ob_actions_folder").hasClass("obActionMenuHidden") === true)
						{
							$("#ob_actions_folder").removeClass("obActionMenuHidden");
						}

						if ($("#ob_actions_folder").hasClass("obActionMenuHidden") === false)
						{
							_vmScope._setFeatureSelectTitle(widgetMenuState, "#ob_actions_folder",
								_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_FOLDERLINK"));

							if (widgetMenuState.HasFolderForLayer === true && widgetMenuState.FeatureCount === 1)
							{
								$("#ob_actions_folder_label").attr("title", widgetMenuState.FolderLinkName);
								$("#ob_actions_folder_button").attr("title", widgetMenuState.FolderLinkName);

								$("#ob_actions_folder_button").removeClass("ob-folderlink-disabled");
								$("#ob_actions_folder_button").addClass("ob-folderlink");

								$("#ob_actions_folder_label").removeClass(disabledClassName);
								$("#ob_actions_folder").removeClass(disabledClassName);

								if (_vmScope._hasWiredFolder === false)
								{
									var ob_actions_folder_button_Click = function()
									{
										_vmScope._executeMenuAction(EnumMenuActionType.Folder);
									};

									$("#ob_actions_folder_button").on("click", ob_actions_folder_button_Click);

									_vmScope._hasWiredFolder = true;
								}

							}
							else
							{
								if (!widgetMenuState.HasFolderForLayer && widgetMenuState.FeatureCount === 1)
								{
									var translatedFolderMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_FOLDERLINKNOLAYER").replace("{0}", widgetMenuState.SingleFeatureLayerName);

									$("#ob_actions_folder_label").attr("title", translatedFolderMsg);
									$("#ob_actions_folder_button").attr("title", translatedFolderMsg);
								}
								else
								{
									var translatedSinglefeatureMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SELECTASINGLEFEATURE");

									$("#ob_actions_folder_label").attr("title", translatedSinglefeatureMsg);
									$("#ob_actions_folder_button").attr("title", translatedSinglefeatureMsg);
								}

								$("#ob_actions_folder_button").removeClass("ob-folderlink");
								$("#ob_actions_folder_button").addClass("ob-folderlink-disabled");

								$("#ob_actions_folder_label").addClass(disabledClassName);
								$("#ob_actions_folder").addClass(disabledClassName);

								$("#ob_actions_folder_button").off("click");
								_vmScope._hasWiredFolder = false;
							}
						}

						//Weblinks
						if ($("#ob_actions_weblink").hasClass("obActionMenuHidden") === false)
						{
							_vmScope._setFeatureSelectTitle(widgetMenuState, "#ob_actions_weblink",
								_vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_WEBLINK"));

							if (widgetMenuState.HasWebPageForLayer && widgetMenuState.FeatureCount === 1)
							{
								$("#ob_actions_weblink_label").attr("title", widgetMenuState.WebLinkName);
								$("#ob_actions_weblink_button").attr("title", widgetMenuState.WebLinkName);
								$("#ob_actions_weblink_button").removeClass("ob-weblink-disabled");
								$("#ob_actions_weblink_button").addClass("ob-weblink");

								$("#ob_actions_weblink_label").removeClass(disabledClassName);
								$("#ob_actions_weblink").removeClass(disabledClassName);

								if (_vmScope._hasWiredWeblink === false)
								{
									var ob_actions_weblink_button_Click = function()
									{
										_vmScope._executeMenuAction(EnumMenuActionType.Weblink);
									};

									$("#ob_actions_weblink_button").on("click", ob_actions_weblink_button_Click);

									_vmScope._hasWiredWeblink = true;
								}
							}
							else
							{
								if (!widgetMenuState.HasWebPageForLayer && widgetMenuState.FeatureCount === 1)
								{
									var translatedWebLinkMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_WEBLINKNOLAYER").replace("{0}", widgetMenuState.SingleFeatureLayerName);

									$("#ob_actions_weblink_label").attr("title", translatedWebLinkMsg);
									$("#ob_actions_weblink_button").attr("title", translatedWebLinkMsg);
								}
								else
								{
									var translatedSinglefeatureMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SELECTASINGLEFEATURE");

									$("#ob_actions_weblink_label").attr("title", translatedSinglefeatureMsg);
									$("#ob_actions_weblink_button").attr("title", translatedSinglefeatureMsg);
								}

								$("#ob_actions_weblink_button").removeClass("ob-weblink");
								$("#ob_actions_weblink_button").addClass("ob-weblink-disabled");

								$("#ob_actions_weblink").addClass(disabledClassName);
								$("#ob_actions_weblink_label").addClass(disabledClassName);

								$("#ob_actions_weblink_button").off("click");
								_vmScope._hasWiredWeblink = false;
							}
						}

						//Logout
						if ($("#ob_actions_logout").hasClass("obActionMenuHidden") === false)
						{
							if (_vmScope._hasWiredLogout === false)
							{
								var ob_actions_logout_button_Click = function()
								{
									_vmScope._executeMenuAction(EnumMenuActionType.Logout);
									//_vmScope._executeMenuAction(EnumMenuActionType.LogoutLoginPrompt);
								};

								$("#ob_actions_logout_button").on("click", ob_actions_logout_button_Click);

								//If we used the prompt then uncomment and change above to LogoutLoginPrompt
								//var ob_hidden_divs_loginLogout_button_Click = function ()
								//{
								//    OnBaseWebHitListUtils.getInstance().logout(true).then()
								//    {
								//        _vmScope._executeMenuAction(EnumMenuActionType.Logout);
								//    };
								//};

								//$("#ob_hidden_divs_loginLogout_button").on("click", ob_hidden_divs_loginLogout_button_Click);

								_vmScope._hasWiredLogout = true;
							}

							$("#ob_actions_logout").removeClass(disabledClassName);
							$("#ob_actions_logout_label").removeClass(disabledClassName);

							if (widgetMenuState.IsUserLoggedIn)
							{
								var logoutMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_LOGOUT");

								$("#ob_actions_logout_label").attr("title", logoutMsg);
								$("#ob_actions_logout_button").attr("title", logoutMsg);
								$("#ob_actions_logout_label").text(logoutMsg);
							}
							else
							{
								var loginMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_LOGIN");

								$("#ob_actions_logout_label").attr("title", loginMsg);
								$("#ob_actions_logout_button").attr("title", loginMsg);
								$("#ob_actions_logout_label").text(loginMsg);
							}
						}

						//Refresh
						if ($("#ob_actions_refresh").hasClass("obActionMenuHidden") === false)
						{
							if (_vmScope._hasWiredRefresh === false)
							{
								var ob_actions_refresh_button_Click = function()
								{
									_vmScope._executeMenuAction(EnumMenuActionType.Refresh);
								};

								$("#ob_actions_refresh_button").on("click", ob_actions_refresh_button_Click);

								_vmScope._hasWiredRefresh = true;

								//We only need to do this once
								$("#ob_actions_refresh").removeClass(disabledClassName);
								$("#ob_actions_refresh_label").removeClass(disabledClassName);
							}
						}
					}
				}
			},

			_setFeatureSelectTitle: function(widgetMenuState, prefixName, defaultTitle)
			{
				var translatedStringObject = _vmScope.widgetConfig.TranslatedStrings;
				var selectFeaturesMsg = _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_SELECTFEATURES_ENABLE");
				var butttonName = prefixName + "_button";
				var labelName = prefixName + "_label";

				if (widgetMenuState.FeatureCount === 0)
				{
					$(butttonName).attr("title", selectFeaturesMsg);
					$(labelName).attr("title", selectFeaturesMsg);
				}
				else
				{
					$(butttonName).attr("title", defaultTitle);
					$(labelName).attr("title", defaultTitle);
				}
			},

			_executeMenuAction: function(enumActionMenuType)
			{
				var menuActionState = _vmScope._widgetMenuStateCache;

				switch (enumActionMenuType)
				{
					case EnumMenuActionType.Import:
                        OnBaseWebHitListUtils.getInstance(menuActionState).importDoc();
						break;
					case EnumMenuActionType.Filter:
						OnBaseWebHitListUtils.getInstance(menuActionState).filter();
						break;
					case EnumMenuActionType.Attach:
						OnBaseWebHitListUtils.getInstance(menuActionState).attach();
						break;
					case EnumMenuActionType.Detach:
						OnBaseWebHitListUtils.getInstance(menuActionState).detach();
						break;
					case EnumMenuActionType.Download:
						OnBaseWebHitListUtils.getInstance(menuActionState).downloadZip();
						break;
					case EnumMenuActionType.Refresh:
						_vmScope.refreshDocumentListAsync();
						break;
					case EnumMenuActionType.Folder:
						OnBaseWebHitListUtils.getInstance(menuActionState).showFolderLink();
						break;
					case EnumMenuActionType.Weblink:
						var webLinkSettings = _vmScope.widgetConfig.WindowSettings.WebLink;
						OnBaseWebHitListUtils.getInstance(menuActionState).showWebLinkAsync(webLinkSettings.Width, webLinkSettings.Height);
						break;
					case EnumMenuActionType.ToggleMenu:
						var expandCollapseControl = $("#ob_expand_collapse_actions");
						if (expandCollapseControl.hasClass("js-ob-invertChevron"))
						{
							expandCollapseControl.removeClass("js-ob-invertChevron");
							$("#ob_toolbar").css("display", "");
						}
						else
						{
							expandCollapseControl.addClass("js-ob-invertChevron");
							$("#ob_toolbar").css("display", "none");
						}
						break;
					case EnumMenuActionType.Logout:
						//If we set this to false we don't need to prompt and handle UI timeout below
						OnBaseWebHitListUtils.getInstance(menuActionState).logout(false).then(function()
						{
							_vmScope.clearSelection();

							// Clear the cached obConfiguredLayers as user does not have session!
							_vmScope._obApi.clearObConfiguredLayersCache();

							//Update the UI
							var translatedStringObject = _vmScope.widgetConfig.TranslatedStrings;
							_vmScope._displayHtml("<p>" + _vmScope._getStrValue(translatedStringObject, "STR_RC_GIS_LOGIN_REFRESH") + "</p>");

							_vmScope._getGetActionMenuStateFromApiAsync();//hides the menu
						});
						break;
					case EnumMenuActionType.LogoutLoginPrompt:
						//This just shows the prompt to logout
						OnBaseWebHitListUtils.getInstance(menuActionState).logout_LogIn(true);
						break;
					case EnumMenuActionType.CloseWorkflowDialog:
						OnBaseWebHitListUtils.getInstance(menuActionState).closeWorkflow();
						break;
					default:
						_vmScope._obApi.log("viewModel._executeMenuAction: Invalid action menu item: " +
							enumActionMenuType, EnumLogType.Error);
						break;
				}
			},

			/**
			 * Determine the esri drawing geometry type based on the string value
			 * passed in.
			 * @param {string} drawTypeString The discrete string value for
			 *  the desired geometry type.
			 * @returns The esri enumerated type of drawing geometry for direct
			 *  input to the drawing tool.
			 */
			_determineEsriDrawType: function(drawTypeString)
			{
				//default and fallback value
				var drawType = Draw.RECTANGLE;

				if (typeof (drawTypeString) === "string")
				{
					switch (drawTypeString.toUpperCase())
					{
						case "POINT":
							drawType = Draw.POINT;
							break;
						case "POLYLINE":
							drawType = Draw.POLYLINE;
							break;
						case "FREEHAND_POLYLINE":
							drawType = Draw.FREEHAND_POLYLINE;
							break;
						case "FREEHAND_POLYGON":
							drawType = Draw.FREEHAND_POLYGON;
							break;
						case "POLYGON":
							drawType = Draw.POLYGON;
							break;
						case "ELLIPSE":
							drawType = Draw.ELLIPSE;
							break;
					}
				}

				return drawType;
			},

			/**
			 * Handles javascript state as well as UI icon swap.
			 */
			_activateDeselectTool: function()
			{
				//check if we need to stop select tool operation first.
				if (_vmScope._isSelectToolActive)
				{
					_vmScope._deactivateSelectTool();
				}

				var deselectTool = $("#ob_btnDeselectTool");

				//swap out icons (non-geometry options mode) 
				if (!_vmScope.widgetConfig.ShouldShowGeometryOptions)
				{
					deselectTool.addClass("obSubtractSelectionSelectedIcon").removeClass("obSubtractSelectionIcon");
				}

				//visually select this toolbar button
				deselectTool.addClass("selected");

				_vmScope.changeSelectionMethod(FeatureLayer.SELECTION_SUBTRACT);

				//activate drawing
				_vmScope._isDeselectToolActive = true;
				_vmScope.initDragSelectTool();
			},

			/**
			 * Handles javascript state as well as UI icon swap.
			 */
			_deactivateDeselectTool: function()
			{
				var deselectTool = $("#ob_btnDeselectTool");

				//swap out icons (non-geometry options mode) 
				if (!_vmScope.widgetConfig.ShouldShowGeometryOptions)
				{
					deselectTool.addClass("obSubtractSelectionIcon").removeClass("obSubtractSelectionSelectedIcon");
				}

				deselectTool.removeClass("selected");

				_vmScope.changeSelectionMethod(FeatureLayer.SELECTION_ADD);

				//suspend drawing
				_vmScope.deactivateDragSelectTool();
				_vmScope._isDeselectToolActive = false;
			},

			/**
			 * Handles javascript state as well as UI icon swap.
			 */
			_activateSelectTool: function()
			{
				//check if we need to stop deselect tool operation first.
				if (_vmScope._isDeselectToolActive)
				{
					_vmScope._deactivateDeselectTool();
				}

				var selectTool = $("#ob_selectFeaturesImg");

				var isDeselectShowing = _vmScope.widgetConfig.ShouldShowDeselectTool;
				var areGeomOptionsShowing = _vmScope.widgetConfig.ShouldShowGeometryOptions;
				//if we are using the deselect tool, but not using geometry mode icons
				if (isDeselectShowing && !areGeomOptionsShowing)
				{
					selectTool.addClass("obAddSelectionSelectedIcon").removeClass("obAddSelectionIcon");
				}

				if (!isDeselectShowing && !areGeomOptionsShowing)
				{
					selectTool.addClass("ob-button-selected");
				}

				//visually select this toolbar button
				selectTool.addClass("selected");

				//activate drawing
				_vmScope._isSelectToolActive = true;
				_vmScope.initDragSelectTool();
			},

			/**
			 * Handles javascript state as well as UI icon swap.
			 */
			_deactivateSelectTool: function()
			{
				var selectTool = $("#ob_selectFeaturesImg");

				//if we are using the deselect tool, but not using geometry mode icons
				if (_vmScope.widgetConfig.ShouldShowDeselectTool &&
					!_vmScope.widgetConfig.ShouldShowGeometryOptions)
				{
					selectTool.addClass("obAddSelectionIcon").removeClass("obAddSelectionSelectedIcon");
				}

				var isDeselectShowing = _vmScope.widgetConfig.ShouldShowDeselectTool;
				var areGeomOptionsShowing = _vmScope.widgetConfig.ShouldShowGeometryOptions;
				if (!isDeselectShowing && !areGeomOptionsShowing)
				{
					selectTool.removeClass("ob-button-selected");
				}

				selectTool.removeClass("selected");

				//suspend drawing
				_vmScope.deactivateDragSelectTool();
				_vmScope._isSelectToolActive = false;
			},

			_displayHtml: function(hitListTableHtml)
			{
				if (hitListTableHtml)
				{
					$('#ob_docs_div').html(hitListTableHtml);
				}
				else
				{
					_vmScope._obApi.log("viewModel._displayHtml: No html was received.", EnumLogType.Error);
				}
			},

			_getHtmlFromApiAsync: function(obLayers)
			{
				var jqDeferred = $.Deferred();

				//Can happen on a de-select
				if (obLayers === undefined || obLayers === null || obLayers.length === 0)
				{
					_vmScope._clearActionMenuState();
					jqDeferred.resolve("<p>" + _vmScope._getStrValue(_vmScope.widgetConfig.TranslatedStrings, "STR_RC_GIS_SELECTFEATS") + "</p>");
				}
				else
				{
					_vmScope._obApi.retrieveDocumentsHtmlAsync(obLayers).then(function(htmlData)
					{
						_vmScope._getGetActionMenuStateFromApiAsync().then(function()
						{
							jqDeferred.resolve(htmlData);
						});
					});
				}

				return jqDeferred;
			},

			_getGetActionMenuStateFromApiAsync: function()
			{
				var jqDeferred = $.Deferred();

				//Make sure we already got the initial action menu state and it needs updated
				if (_vmScope._hasInitialActionMenuItems === true)
				{
					_vmScope._obApi.getGetActionMenuStateAsync().then(function(actionMenuState)
					{
						_vmScope._setActionMenuState(actionMenuState);
						_vmScope._obApi.log("viewModel._getGetActionMenuStateFromApiAsync: Action Menu state updated.",
							EnumLogType.Info);
						jqDeferred.resolve(true);
					});
				}
				else
				{
					jqDeferred.resolve(true);
				}

				return jqDeferred;
			},

			_wireupListeners: function()
			{
				this._map.on('layer-add', lang.hitch(this, this._onEsriLayerAdd));
				this._map.on('layer-remove', lang.hitch(this, this._onEsriLayerRemove));

				window.addEventListener("message", function(e)
				{
					_vmScope._processChildWindowMessages(e.data);
				}, false);
			},

			_processChildWindowMessages: function(msgObject)
			{
				var pageName = msgObject.pageName;
				var pageData = msgObject.data;
				var isApply = msgObject.isApply;

				if (isApply)
				{
					var enumPageName = EnumMenuActionPageNames.UnKnown;
					var pageNameLower = pageName.toLowerCase();

					if (pageNameLower == EnumMenuActionPageNames.LoginClose)
					{
						enumPageName = EnumMenuActionPageNames.LoginClose;
					}
					else if (pageNameLower == EnumMenuActionPageNames.Filter)
					{
						enumPageName = EnumMenuActionPageNames.Filter;
					}

					switch (enumPageName)
					{
						case EnumMenuActionPageNames.LoginClose:
							//We assume the user was able to login through the control at this point (called close.aspx), but session cookies could an issue
							//We sanity check Web API before a refresh (to avoid endless loop login prompts)?
							_vmScope._obApi.hasSessionAsync().then(function(hasSession)
							{
								//Update menu actions and hit list display via a refresh
								_vmScope._executeMenuAction(EnumMenuActionType.Refresh);
							});
							_vmScope._obApi.log("viewModel._processChildWindowMessages: Child window applied from: " +
								pageName, EnumLogType.Info);
							break;
						case EnumMenuActionPageNames.Filter:

							//We need to set this from the current window
							var filterDataObject = pageData;

							//We may have to apply the sessionStorage based filtering from the filter window
							if (_vmScope.widgetConfig.WidgetActionMenuOptions.IsPersistFilterInBrowser === false)
							{
								var filterKey = _vmScope._obApi.determineFilterLocalStorageKeyName();

								if (filterDataObject)
								{
									var filterJsonData = JSON.stringify(filterDataObject);
									//Apply to this parent window (from the child filter window)
									ObGisStorage.setItem(filterKey, filterJsonData, EnumObStorageType.SESSION);

									_vmScope._obApi.log('Filter set for session only.');
								}
								else
								{
									ObGisStorage.removeItem(filterKey, EnumObStorageType.SESSION);
									_vmScope._obApi.log('Filter cleared on session.');
								}
							}
							else
							{
								if (filterDataObject)
								{
									//Should we store here as well for cross-domain or is that handled on local storage in the filter window already?
									_vmScope._obApi.log('Filter set persistent.');
								}
								else
								{
									_vmScope._obApi.log('Filter cleared persistent.');
								}
							}
							//Apply the filter via a refresh
							_vmScope._executeMenuAction(EnumMenuActionType.Refresh);
							//We have to apply the storage across windows 
							_vmScope._obApi.log("viewModel._processChildWindowMessages: Child window applied from: " +
								pageName, EnumLogType.Info);
							break;
						default:
							_vmScope._obApi.log("viewModel._processChildWindowMessages: Child window action unsupported: '" +
								pageName + "'", EnumLogType.Info);
							break;
					}
				}
				else
				{
					_vmScope._obApi.log("viewModel._processChildWindowMessages: Child window reports from: " +
						pageName, EnumLogType.Info);
				}
			},

			_toggleWidget: function(w, h)
			{
				var widgetDivName = this.widgetConfig.JQueryWidgetDivId;
				if (this._widgetShowing)
				{

					$(widgetDivName).dialog("close");
					$(widgetDivName).hide();
					this._widgetShowing = false;
				}
				else
				{
					$(widgetDivName).show();

					if (!this._widgetShowingDialogWiredUp)
					{
						$(widgetDivName).dialog({
							resizable: true,
							modal: false,
							width: w,
							height: h,
							minWidth: 315,
							classes: {
								"ui-dialog-content": "obJQueryUIDialogContent"
							} //Adds obJQueryUIDialogContent class to elements with ui-dialog-content class.

						});


						$(widgetDivName).bind('dialogclose', function(event)
						{
							_vmScope._widgetShowing = false;
						});
						this._widgetShowingDialogWiredUp = true;
						this.checkSessionAsync();//Check the session the first time
					}
					else
					{
						$(widgetDivName).dialog("open");
					}

					this._widgetShowing = true;
				}
			},

			_isInt: function(data)
			{
				var isInt = false;

				if (data === parseInt(data, 10))
					isInt = true
				else
					isInt = false;

				return isInt;
			},

			_selectFeatures: function(drawnGeometry)
			{
				var selectQuery = new Query();
				selectQuery.geometry = drawnGeometry;
				// TODO: out fields to be configured/mapped fields only
				var geomType = drawnGeometry.type;
				if (geomType === 'point' || geomType === 'multipoint' ||
					geomType === 'polyline')
				{
					//need to set this so it is possible to select features
					selectQuery.distance = _vmScope._queryDistance;
				}
				selectQuery.outFields = ['*'];

				var featureLayers = _vmScope._selectableLayers;
				var selectionMethod = _vmScope._selectionMethod;
				for (var i = 0, len = featureLayers.length; i < len; i++)
				{
					featureLayers[i].selectFeatures(selectQuery, selectionMethod);
				}
			},

			_setScopeTranslations: function(widgetConfiguration)
			{
				_vmScope.STR_PRODUCT_NAME = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_PRODUCT_NAME");
				_vmScope.STR_RC_GIS_CLOSE = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_CLOSE");
				_vmScope.STR_RC_GIS_SELECTFEATS = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_SELECTFEATS");
				_vmScope.STR_RC_GIS_LOGINSELECTFEATS = _vmScope._getStrValue(widgetConfiguration.TranslatedStrings, "STR_RC_GIS_LOGINSELECTFEATS");
			},

			_getStrValue: function(translationObject, STR_CONSTANT)
			{
				var strValue = "Translation not found.";
				var keyValPair = null;

				if (translationObject !== undefined)
				{
					var strValueTemp = translationObject[STR_CONSTANT];//property/hash lookup
					if (strValueTemp !== undefined)
					{
						strValue = strValueTemp;
					}
				}
				else
				{
					_vmScope._obApi.log("viewModel._getStrValue: translationObject is undefined",
						EnumLogType.Error);
				}

				return strValue;
			},

			_getSelectionSymbol: function(geometryType)
			{
				var symbol = null;
				switch (geometryType)
				{
					case 'esriGeometryPolygon':
						symbol = _vmScope._polygonHighlightSymbol;
						break;
					case 'esriGeometryPolyline':
						symbol = _vmScope._polylineHighlightSymbol;
						break;
					default:
						symbol = _vmScope._pointHighlightSymbol;
						break;
				}

				return symbol;
			},

			_setLayerSelectionSymbol: function(layer)
			{
				layer.setSelectionSymbol(_vmScope._getSelectionSymbol(layer.geometryType));
			},

			_addFeatureLayer: function(layerName, featureLayer)
			{
				//If the configured layers have not yet been retrieved from the server, 
				//isConfiguredLayerId will return false for layers that are actually configured.
				var isValid = _vmScope._bypassConfiguredLayerValidation ? true :
					_vmScope._obApi.isConfiguredLayerId(layerName);

				if (isValid)
				{
					featureLayer.on('selection-complete', lang.hitch(this, this._onSelectionComplete));

					if (this._useOBHighlighting)
					{
						this._setLayerSelectionSymbol(featureLayer);
					}

					this._selectableLayers.push(featureLayer);

					this._obApi.log('viewModel._addFeatureLayer: added layer [name]: ' +
						layerName + ' [tally]: ' + this._selectableLayers.length);
				}
				else
				{
					_vmScope._obApi.log("viewModel._addFeatureLayer: no session or layer not configured. [name]: " + layerName);
				}
			},

			_validateAndAddLayer: function(lyr)
			{
				var isFeatureLayer = lyr.hasOwnProperty('type') && lyr.type === 'Feature Layer';
				var lyrHasNotBeenAdded = _vmScope._selectableLayers.indexOf(lyr) === -1;
				if (isFeatureLayer && lyrHasNotBeenAdded)
				{
					//TODO: This should actually publish/emit an event to which Cityworks-specific code subscribes,
					//	whereby decoupling integration-specific logic from this shared esri view model.
					//#region Specific to Cityworks.
					if (_vmScope._isCityworksMode)
					{
						//At least as late as Cityworks 15.2.x, getOriginalLayerNameFromSelectableLayerId method will return "" if
						//the layer is not a selected layer (they also call these queryLayers in their code.)
						var originalLayerName = _vmScope._cityworksProxyObj.map.layers.getOriginalLayerNameFromSelectableLayerId(lyr.id);

						if (typeof (originalLayerName) === "string" && originalLayerName.length > 0)
						{
							//need to set this property for OB_WebAPI usage.
							lyr.obCityworksName = originalLayerName;

							_vmScope._addFeatureLayer(originalLayerName, lyr);
						}
						else
						{
							_vmScope._obApi.log("viewModel._validateAndAddLayer: [cityworks mode] originalLayerName for layer: " + lyr.name +
								" is empty, this is not a selected layer and will not be used.");
						}
					}
					else
					{
						_vmScope._addFeatureLayer(lyr.name, lyr);
					}
					//#endregion
				}
				else
				{
					var lyrMsg = "[id]: " + lyr.id;

					if (!isFeatureLayer)
					{
						_vmScope._obApi.log("viewModel._validateAndAddLayer: ignore non-FeatureLayer: " + lyrMsg);
					}
					else if (!lyrHasNotBeenAdded)
					{
						lyrMsg += " [name]: " + lyr.name;
						_vmScope._obApi.log("viewModel._validateAndAddLayer: layer already added: " + lyrMsg);
					}
				}
			},

			_findAndRemoveLayer: function(lyr)
			{
				var index = this._selectableLayers.indexOf(lyr);
				if (index !== -1)
				{
					var removed = this._selectableLayers.splice(index, 1);
					this._obApi.log('viewModel._findAndRemoveLayer: removed layer [id]: ' + lyr.id + ' [name]: ' +
						lyr.name + ' [tally]: ' + this._selectableLayers.length);
				}
			},

			_toggleLoadingSpinner: function(showLoading)
			{
				_vmScope._obApi.toggleLoadingSpinner(showLoading);
			},

			/**
			 * Helper that does 2 things:
			 *  -Returns a boolean for whether the user has a session or not.
			 *  -Pops login dialog if a session is needed to continue.
			 * @returns {Object} jQuery Deferred, callback argument is a bool for whether or not a session is needed.
			 */
			_requiresOnBaseSessionAsync: function()
			{
				var jqDeferred = $.Deferred();

				this._obApi.requiresSessionAsync()
					.then(function(requiresSession)
					{
						if (requiresSession)
						{
							_vmScope._obApi.promptForSession();
						}
						jqDeferred.resolve(requiresSession);
					})
					.fail(function(error)
					{

						_vmScope._obApi.log("viewModel._requiresOnBaseSessionAsync: error checking session " +
							error, EnumLogType.Error);

						jqDeferred.reject(error);
					});
				return jqDeferred;
			},

			/**
			 * Safely determine the input tolerance based on user configuration data
			 * passed in.
			 * @param {number} inputTolerance The numeric value for tolerance
			 *  from user configuration.
			 * @returns {number} A safely-determined value for tolerance.
			 */
			_getIdentifyQueryTolerance: function(inputTolerance)
			{
				//default and fallback
				var identifyQueryTolerance = 3;

				if (_vmScope._isInt(inputTolerance) && inputTolerance >= 0)
				{
					identifyQueryTolerance = inputTolerance;
				}

				return identifyQueryTolerance;
			},

			/**
			 * Perform an esri QueryTask based on the geometry, used as a spatial filter,
			 * passed in.
			 * @param {Object} geometry The geometry object, such as from the drawing tool,
			 *   that will be used as a constraint to get features from the layers held in memory.
			 * @returns {Object} A result object containing the layers queried, and an array of deferred results:
			 *  featureLayers: selectableLayers, 
			 *  deferredObjects: arrayOfDeferredObjects
			 */
			_doQuery: function(geometry)
			{
				//Query requires one of the following properties: geometry, text, or where.
				var query = new Query();
				query.distance = _vmScope._identifyQueryTolerance;
				query.geometry = geometry;
				query.outFields = ["*"];
				query.returnGeometry = true;
				query.spatialRelationship = Query.SPATIAL_REL_INTERSECTS;

				var arrayOfDeferredObjects = [];
				var selectableLayers = _vmScope._selectableLayers;

				if (selectableLayers.length > 0)
				{
					for (var i = 0, len = selectableLayers.length; i < len; i++)
					{
						var featureLayer = selectableLayers[i];

						var queryTask = new QueryTask(featureLayer.url);
						var layerName = featureLayer.name;

						if (featureLayer.visible)
						{
							//WARNING: esri framework QueryTask.execute method returns dojo/_base/Deferred
							// which is deprecated. Until they change it to use preferred dojo objects, we are
							// stuck using the deprecated object and methods on it.
							var deferredQueryResult = queryTask.execute(query).addCallback(function(featureSet)
							{
								return arrayUtils.map(featureSet.features, function(esriGraphic)
								{
									return esriGraphic;
								});
							});
							arrayOfDeferredObjects.push(deferredQueryResult);
						}
					}
				}
				else
				{
					_vmScope._obApi.log("viewModel._doQuery: There are no selectable layers in memory to query.", EnumLogType.Warn);
				}


				return { featureLayers: selectableLayers, deferredObjects: arrayOfDeferredObjects };
			},

			/**
			 * Perform an esri IdentifyTask based on the geometry, used as a spatial filter,
			 * passed in.
			 * @param {Object} geometry The geometry object, such as from the drawing tool,
			 *   that will be used as a constraint to get features from the layers held in memory.
			 * @returns {Object} A result object containing the layers queried, and an array of deferred results:
			 *  featureLayers: selectableLayers, 
			 *  deferredObjects: arrayOfDeferredObjects
			 */
			_doIdentify: function(geometry)
			{
				var identifyParams = new IdentifyParameters();
				identifyParams.geometry = geometry;

				identifyParams.tolerance = _vmScope._identifyQueryTolerance;
				identifyParams.returnGeometry = true;
				identifyParams.layerOption = IdentifyParameters.LAYER_OPTION_ALL;
				identifyParams.width = _vmScope._map.width;
				identifyParams.height = _vmScope._map.height;
				identifyParams.mapExtent = _vmScope._map.extent;

				var arrayOfDeferredObjects = [];

				var selectableLayers = _vmScope._selectableLayers;

				if (selectableLayers.length > 0)
				{
					for (var i = 0, len = selectableLayers.length; i < len; i++)
					{
						var featureLayer = selectableLayers[i];

						if (featureLayer.visible)
						{
							var url = featureLayer.url;
							var baseComponent = parseInt(url.substring(url.lastIndexOf("/") + 1));
							var serviceUrl = url.substring(0, url.lastIndexOf("/"));

							var identifyTask = new IdentifyTask(serviceUrl);
							identifyParams.layerIds = [baseComponent];

							//WARNING: esri framework IdentifyTask.execute method returns dojo/_base/Deferred
							// which is deprecated. Until they change it to use preferred dojo objects, we are
							// stuck using the deprecated object and methods on it.
							var deferredIdentifyResult = identifyTask.execute(identifyParams)
								.addCallback(function(identifyResultArray)
								{
									return arrayUtils.map(identifyResultArray, function(identifyResult)
									{
										return identifyResult.feature;
									});
								});
							arrayOfDeferredObjects.push(deferredIdentifyResult);
						}
					}
				}
				else
				{
					_vmScope._obApi.log("viewModel._doIdentify: There are no selectable layers in memory to identify.", EnumLogType.Warn);
				}

				return { featureLayers: selectableLayers, deferredObjects: arrayOfDeferredObjects };
			},

			/**
			 * Update the hit list by supplying the cached last identified or queried result object.
			 * @param {Object} lastQueriedOrIdentifiedResult An object with the following properties:
			 *  featureLayers: selectableLayers, 
			 *  deferredObjects: arrayOfDeferredObjects
			 * @returns {Object} jQuery/Deferred no argument. Provided so it is 'thenable.'
			 */
			_updateHitListAsync: function(lastQueriedOrIdentifiedResult)
			{
				var jqDeferred = $.Deferred();

				//lastQueriedOrIdentifiedResult may not be set due to hitting refresh without selecting
				var featureLayers = lastQueriedOrIdentifiedResult ? lastQueriedOrIdentifiedResult.featureLayers : null;
				var arrayDeferred = lastQueriedOrIdentifiedResult ? lastQueriedOrIdentifiedResult.deferredObjects : null;

				if (featureLayers !== null && arrayDeferred != null)
				{
					_vmScope._all(arrayDeferred).then(function(resolvedGraphicsArrays)
					{
						_vmScope.updateHitListFromIdentifyOrQueryAsync(lastQueriedOrIdentifiedResult.featureLayers,
							resolvedGraphicsArrays)
							.then(function()
							{
								jqDeferred.resolve();
							})
							.fail(function()
							{
								jqDeferred.reject();
							});
					});
				}
				else
				{
					_vmScope._getHtmlFromApiAsync(null).then(_vmScope._displayHtml);
					jqDeferred.resolve();
				}

				return jqDeferred;
			},

			_all: function(arrayDojoDeferreds)
			{
				//dojo/promise/all is a function that takes multiple promises and 
				// returns a new promise that is fulfilled when all promises have 
				// been resolved or one has been rejected.
				return all(arrayDojoDeferreds);
			}

			//#endregion
		});
	});