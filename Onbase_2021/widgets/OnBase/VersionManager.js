﻿define(['jimu/shared/BaseVersionManager'],
function (BaseVersionManager)
{

    function VersionManager()
    {
        this.versions = [{
            version: '1.0',
            upgrader: function (oldConfig)
            {
                return oldConfig;
            }
        }, {
            version: '1.1',
            upgrader: function (oldConfig)
            {
                var newConfig = oldConfig;
                return newConfig;
            }
        }];
    }

    VersionManager.prototype = new BaseVersionManager();
    VersionManager.prototype.constructor = VersionManager;
    return VersionManager;
});