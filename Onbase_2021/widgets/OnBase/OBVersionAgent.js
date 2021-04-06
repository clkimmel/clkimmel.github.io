var OBVersionAgent = (function(undefined)
{
    var _apiUrlSubPath = "api/GisService";
    var _rootUrl = "";
    var _webApiUrl = "";


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

    function _getFailCallback(inputErrMsg, isAjaxCall)
    {
        // Note that fail/catch 
        // callbacks do not handle thrown exceptions. 
        // They handle rejection values only.
        var failCallback = function(callbackError)
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
            failCallback = function(jqXhr, textStatus, errorThrown)
            {
                if (console)
                {
                    errText = "[ERRORTHROWN:] " + errorThrown +
                        " [STATUS:] " + textStatus;

                    if (jqXhr.responseText)
                    {
                        errText += " [RESPONSETEXT:] " + jqXhr.responseText;
                    }
                    //Do not check debug mode. We always want to display this.
                    console.error(inputErrMsg + " " + errText);
                }
            };
        }

        return failCallback;
    }

    function _getVersionStampQueryStringAsync()
    {
        var getVersionStampUrl = _webApiUrl + "/" + "GetVersionStamp";

        return _execAjaxRequestAsync(getVersionStampUrl, "json").then(function(stamp)
        {
            return "?v=" + stamp;
        });
    }


    return {

        getVersionStampQueryStringAsync: function(rootUrl)
        {
            function _endsWith(str, suffix)
            {
                return str.indexOf(suffix, str.length - suffix.length) !== -1;
            }

            if (_endsWith(rootUrl, "/"))
            {
                _rootUrl = rootUrl;
            }
            else
            {
                _rootUrl = rootUrl + "/";
            }

            _webApiUrl = _rootUrl + _apiUrlSubPath;

            return _getVersionStampQueryStringAsync();
        }

    };

})();

//#region dojo AMD wrapper
if (typeof define !== "undefined")
{
    define([], function()
    {

        return {

            getVersionStampQueryStringAsync: function(rootUrl)
            {
                return OBVersionAgent.getVersionStampQueryStringAsync(rootUrl);
            }

        };

    });
}
//#endregion