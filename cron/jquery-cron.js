/*
 * jQuery gentleSelect plugin (version 0.1.4.1)
 * http://shawnchin.github.com/jquery-cron
 *
 * Copyright (c) 2010-2013 Shawn Chin.
 * Dual licensed under the MIT or GPL Version 2 licenses.
 *
 * Requires:
 * - jQuery
 *
 * Usage:
 *  (JS)
 *
 *  // initialise like this
 *  var c = $('#cron').cron({
 *    initial: '9 10 * * *', # Initial value. default = "* * * * *"
 *    url_set: '/set/', # POST expecting {"cron": "12 10 * * 6"}
 *  });
 *
 *  // you can update values later
 *  c.cron("value", "1 2 3 4 *");
 *
 * // you can also get the current value using the "value" option
 * alert(c.cron("value"));
 *
 *  (HTML)
 *  <div id='cron'></div>
 *
 * Notes:
 * At this stage, we only support a subset of possible cron options.
 * For example, each cron entry can only be digits or "*", no commas
 * to denote multiple entries. We also limit the allowed combinations:
 * - Every minute : * * * * *
 * - Every hour   : ? * * * *
 * - Every day    : ? ? * * *
 * - Every week   : ? ? * * ?
 * - Every month  : ? ? ? * *
 * - Every year   : ? ? ? ? *
 */
(function($) {

    var defaults = {
        languageUrl: undefined,
        initial : "* * * * *",
        minuteOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 30,
            columns   : 4,
            rows      : undefined,
            title     : "Minutes Past the Hour"
        },
        timeHourOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 20,
            columns   : 2,
            rows      : undefined,
            title     : "Time: Hour"
        },
        domOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 30,
            columns   : undefined,
            rows      : 10,
            title     : "Day of Month"
        },
        monthOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 100,
            columns   : 2,
            rows      : undefined,
            title     : undefined
        },
        dowOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : undefined,
            columns   : undefined,
            rows      : undefined,
            title     : undefined
        },
        timeMinuteOpts : {
            minWidth  : 100, // only applies if columns and itemWidth not set
            itemWidth : 20,
            columns   : 4,
            rows      : undefined,
            title     : "Time: Minute"
        },
        effectOpts : {
            openSpeed      : 400,
            closeSpeed     : 400,
            openEffect     : "slide",
            closeEffect    : "slide",
            hideOnMouseOut : true
        },
        url_set : undefined,
        customValues : undefined,
        onChange: undefined, // callback function each time value changes
        useBootstrapMultiSelect: false,
        useGentleSelect: false
    };

    // -------  Define plugin-wide variables -------
    // Dictionary of localizable strings and localized values
    var i18nMap = {};
    // options for minutes in an hour
    var str_opt_mih = "";
    // options for hours in a day
    var str_opt_hid = "";
    // options for days of month
    var str_opt_dom = "";
    // options for months
    var str_opt_month = "";
    // options for day of week
    var str_opt_dow = "";
    // options for period
    var str_opt_period = "";
    // display matrix
    var toDisplay = {};
    var combinations = {};
    var months = ["January", "February", "March", "April",
                  "May", "June", "July", "August",
                  "September", "October", "November", "December"];
    var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
                "Friday", "Saturday"];


    // ------------------ internal functions ---------------
    function initializeI18nMap(languageUrl) {
        // Defaults to English in case no language pack is available at all
        var i18nMapDefaults = {
                // Months
                "January": "January",
                "February": "February",
                "March": "March",
                "April": "April",
                "May": "May",
                "June": "June",
                "July": "July",
                "August": "August",
                "September": "September",
                "October": "October",
                "November": "November",
                "December": "December",
                // Day of the week
                "Sunday": "Sunday",
                "Monday": "Monday",
                "Tuesday": "Tuesday",
                "Wednesday": "Wednesday",
                "Thursday": "Thursday",
                "Friday": "Friday",
                "Saturday": "Saturday",
                // Periods
                "minute": "minute",
                "hour": "hour",
                "day": "day",
                "week": "week",
                "month": "month",
                "year": "year",
                // Miscellaneous
                "At": "at",
                "OnThe": "on the",
                "SuffixSt": "st",
                "SuffixNd": "nd",
                "SuffixRd": "rd",
                "SuffixTh": "th",
                "Every": "Every",
                // readable description
                "EveryMinute": "Every minute",
                "HourDesc": "{minute} minutes past every hour",
                "DayDesc": "Every day at {hour}:{minute}",
                "WeekDesc": "Every {dow} at {hour}:{minute}",
                "MonthDesc": "On {dom} of every month at {hour}:{minute}",
                "YearDesc": "On {dom} of every {month} at {hour}:{minute}",
        };
        if (! languageUrl) {
            i18nMap = i18nMapDefaults;
            return;
        }
        i18nMap = getI18nLookupTable(languageUrl);
        if (! i18nMap) {
            i18nMap = i18nMapDefaults;
        }
    }
    
    function getI18nLookupTable(languageUrl) {
        var jsonFileContent = $.ajax({
                type: "GET",
                url: languageUrl,
                async: false
            }).responseText;
        if (jsonFileContent) {
            return $.parseJSON(jsonFileContent);
        } else {
            return undefined;
        }
    }
    
    function getFormattedHourOrMinute(i) {
        if (i<10) {
            return "0" + i;
        } else {
            return i;
        }
    }
    
    function getDaySuffix(dayOfMonth) {
        var suffix = "";
        if (dayOfMonth == 1 || dayOfMonth == 21 || dayOfMonth == 31) {
            suffix = i18nMap['SuffixSt'];
        } else if (dayOfMonth == 2 || dayOfMonth == 22) {
            suffix = i18nMap['SuffixNd'];
        } else if (dayOfMonth == 3 || dayOfMonth == 23) {
            suffix = i18nMap['SuffixRd'];
        } else {
            suffix = i18nMap['SuffixTh'];
        }
        return suffix; 
    }

    function initializeGlobalVariables() {
        for (var i = 0; i < 60; i++) {
            str_opt_mih += "<option value='"+i+"'>" + getFormattedHourOrMinute(i) + "</option>\n";
        }
    
        for (var i = 0; i < 24; i++) {
            str_opt_hid += "<option value='"+i+"'>" + getFormattedHourOrMinute(i) + "</option>\n";
        }
    
        for (var i = 1; i < 32; i++) {
            var suffix = getDaySuffix(i);
            str_opt_dom += "<option value='"+i+"'>" + i + suffix + "</option>\n";
        }

        for (var i = 0; i < months.length; i++) {
            str_opt_month += "<option value='"+(i+1)+"'>" + i18nMap[months[i]] + "</option>\n";
        }

        for (var i = 0; i < days.length; i++) {
            str_opt_dow += "<option value='"+i+"'>" + i18nMap[days[i]] + "</option>\n";
        }

        var periods = ["minute", "hour", "day", "week", "month", "year"];
        for (var i = 0; i < periods.length; i++) {
            str_opt_period += "<option value='"+periods[i]+"'>" + i18nMap[periods[i]] + "</option>\n";
        }

        // display matrix
       toDisplay = {
           "minute" : [],
           "hour"   : ["mins"],
           "day"    : ["time"],
           "week"   : ["dow", "time"],
           "month"  : ["dom", "time"],
           "year"   : ["dom", "month", "time"]
       };

       combinations = {
           "minute" : /^(\*\s){4}\*$/,                    // "* * * * *"
           "hour"   : /^\d{1,2}\s(\*\s){3}\*$/,           // "? * * * *"
           "day"    : /^(\d{1,2}\s){2}(\*\s){2}\*$/,      // "? ? * * *"
           "week"   : /^(\d{1,2}\s){2}(\*\s){2}\d{1,2}$/, // "? ? * * ?"
           "month"  : /^(\d{1,2}\s){3}\*\s\*$/,           // "? ? ? * *"
           "year"   : /^(\d{1,2}\s){4}\*$/                // "? ? ? ? *"
       };
    }
    
    function getLocalizedString(s, replacements) {
        if (! defined(replacements)) {
            return s;
        }
        $.each(replacements, function(key, value){
            // Note that this only replaces the first occurrance, however, good enough for cron strings
            s = s.replace("{" + key + "}", value);
        });
        return s;
    }

    function defined(obj) {
        if (typeof obj == "undefined") { return false; }
        else { return true; }
    }

    function undefinedOrObject(obj) {
        return (!defined(obj) || typeof obj == "object")
    }

    function getCronType(cron_str, opts) {
        // if customValues defined, check for matches there first
        if (defined(opts.customValues)) {
            for (key in opts.customValues) {
                if (cron_str == opts.customValues[key]) { return key; }
            }
        }

        // check format of initial cron value
        var valid_cron = /^((\d{1,2}|\*)\s){4}(\d{1,2}|\*)$/
        if (typeof cron_str != "string" || !valid_cron.test(cron_str)) {
            $.error("cron: invalid initial value");
            return undefined;
        }

        // check actual cron values
        var d = cron_str.split(" ");
        //            mm, hh, DD, MM, DOW
        var minval = [ 0,  0,  1,  1,  0];
        var maxval = [59, 23, 31, 12,  6];
        for (var i = 0; i < d.length; i++) {
            if (d[i] == "*") continue;
            var v = parseInt(d[i]);
            if (defined(v) && v <= maxval[i] && v >= minval[i]) continue;

            $.error("cron: invalid value found (col "+(i+1)+") in " + o.initial);
            return undefined;
        }

        // determine combination
        for (var t in combinations) {
            if (combinations[t].test(cron_str)) { return t; }
        }

        // unknown combination
        $.error("cron: valid but unsupported cron format. sorry.");
        return undefined;
    }

    function hasError(c, o) {
        if (!defined(getCronType(o.initial, o))) { return true; }
        if (!undefinedOrObject(o.customValues)) { return true; }

        // ensure that customValues keys do not coincide with existing fields
        if (defined(o.customValues)) {
            for (key in o.customValues) {
                if (combinations.hasOwnProperty(key)) {
                    $.error("cron: reserved keyword '" + key +
                            "' should not be used as customValues key.");
                    return true;
                }
            }
        }

        return false;
    }

    function getCurrentValue(c) {
        var b = c.data("block");
        var min = hour = day = month = dow = "*";
        var selectedPeriod = b["period"].find("select").val();
        switch (selectedPeriod) {
            case "minute":
                break;

            case "hour":
                min = b["mins"].find("select").val();
                break;

            case "day":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                break;

            case "week":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                dow  =  b["dow"].find("select").val();
                break;

            case "month":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day  = b["dom"].find("select").val();
                break;

            case "year":
                min  = b["time"].find("select.cron-time-min").val();
                hour = b["time"].find("select.cron-time-hour").val();
                day  = b["dom"].find("select").val();
                month = b["month"].find("select").val();
                break;

            default:
                // we assume this only happens when customValues is set
                return selectedPeriod;
        }
        return [min, hour, day, month, dow].join(" ");
    }

    // -------------------  PUBLIC METHODS -----------------

    var methods = {
        init : function(opts) {

            // init options
            var options = opts ? opts : {}; /* default to empty obj */
            var o = $.extend([], defaults, options);
            var eo = $.extend({}, defaults.effectOpts, options.effectOpts);
            $.extend(o, {
                minuteOpts     : $.extend({}, defaults.minuteOpts, eo, options.minuteOpts),
                domOpts        : $.extend({}, defaults.domOpts, eo, options.domOpts),
                monthOpts      : $.extend({}, defaults.monthOpts, eo, options.monthOpts),
                dowOpts        : $.extend({}, defaults.dowOpts, eo, options.dowOpts),
                timeHourOpts   : $.extend({}, defaults.timeHourOpts, eo, options.timeHourOpts),
                timeMinuteOpts : $.extend({}, defaults.timeMinuteOpts, eo, options.timeMinuteOpts)
            });
            // convert to cron string in case a quartz string was passed in
            o.initial = methods["toCronString"].call(this, o.initial); // set initial value
            
            // initialize global variables for this plugin
            initializeI18nMap(o.languageUrl);
            initializeGlobalVariables();

            // error checking
            if (hasError(this, o)) { return this; }

            // ---- define select boxes in the right order -----

            var block = [], custom_periods = "", cv = o.customValues;
            if (defined(cv)) { // prepend custom values if specified
                for (var key in cv) {
                    custom_periods += "<option value='" + cv[key] + "'>" + key + "</option>\n";
                }
            }

            block["period"] = $("<span class='cron-period'>"
                    + i18nMap['Every'] + " <select name='cron-period'>" + custom_periods
                    + str_opt_period + "</select> </span>")
                .appendTo(this)
                .data("root", this);

            var select = block["period"].find("select");
            select.bind("change.cron", event_handlers.periodChanged)
                  .data("root", this);
            if (o.useGentleSelect) select.gentleSelect(eo);

            block["dom"] = $("<span class='cron-block cron-block-dom'>"
                    + " " + i18nMap['OnThe'] + " <select name='cron-dom'>" + str_opt_dom
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this);

            select = block["dom"].find("select").data("root", this);
            if (o.useGentleSelect) select.gentleSelect(o.domOpts);

            block["month"] = $("<span class='cron-block cron-block-month'>"
                    + " " + i18nMap['Of'] + " <select name='cron-month'>" + str_opt_month
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this);

            select = block["month"].find("select").data("root", this);
            if (o.useGentleSelect) select.gentleSelect(o.monthOpts);

            block["mins"] = $("<span class='cron-block cron-block-mins'>"
                    + " " + i18nMap['At'] + " <select name='cron-mins'>" + str_opt_mih
                    + "</select> " + i18nMap['MinutesPastTheHour'] + " </span>")
                .appendTo(this)
                .data("root", this);

            select = block["mins"].find("select").data("root", this);
            if (o.useGentleSelect) select.gentleSelect(o.minuteOpts);

            block["dow"] = $("<span class='cron-block cron-block-dow'>"
                    + " " + i18nMap['On'] + " <select name='cron-dow'>" + str_opt_dow
                    + "</select> </span>")
                .appendTo(this)
                .data("root", this);

            select = block["dow"].find("select").data("root", this);
            if (o.useGentleSelect) select.gentleSelect(o.dowOpts);

            block["time"] = $("<span class='cron-block cron-block-time'>"
                    + " " + i18nMap['At'] + " <select name='cron-time-hour' class='cron-time-hour'>" + str_opt_hid
                    + "</select>:<select name='cron-time-min' class='cron-time-min'>" + str_opt_mih
                    + " </span>")
                .appendTo(this)
                .data("root", this);

            select = block["time"].find("select.cron-time-hour").data("root", this);
            if (o.useGentleSelect) select.gentleSelect(o.timeHourOpts);
            select = block["time"].find("select.cron-time-min").data("root", this);
            if (o.useGentleSelect) select.gentleSelect(o.timeMinuteOpts);

            block["controls"] = $("<span class='cron-controls'>&laquo; save "
                    + "<span class='cron-button cron-button-save'></span>"
                    + " </span>")
                .appendTo(this)
                .data("root", this)
                .find("span.cron-button-save")
                    .bind("click.cron", event_handlers.saveClicked)
                    .data("root", this)
                    .end();

            this.find("select").bind("change.cron-callback", event_handlers.somethingChanged);
            this.data("options", o).data("block", block); // store options and block pointer
            this.data("current_value", o.initial); // remember base value to detect changes

            return methods["value"].call(this, o.initial); // set initial value
        },
        
        toCronString: function(cronOrQuartz) {
            if (! defined(cronOrQuartz)) {
                return cronOrQuartz;
            }
            var parts = cronOrQuartz.split(" ");
            var numParts = parts.length;
            if (numParts.length < 5 || numParts > 6) {
                // For quartz, it's possible to have length 7 with last optional year field
                // not supported by this front end yet
                return cronOrQuartz; 
            }
            var minute = parts[numParts - 5];
            var hour = parts[numParts - 4];
            var dayOfMonth = parts[numParts - 3];
            var month = parts[numParts - 2];
            var dayOfWeek = parts[numParts - 1];
            if (numParts == 6) {
                // this is a quartz string, replace questions marks with stars
                if (isNaN(dayOfWeek)) {
                    if (dayOfWeek == "?") {
                        dayOfWeek = "*";
                    }
                } else {
                    // DoW is 0-6 in cron, but 1-7 in quartz
                    dayOfWeek = dayOfWeek - 1;
                }
                if (dayOfMonth == "?") {
                    dayOfMonth = "*";
                }
                if (month == "?") {
                    month = "*";
                }
            }
            var cronString = minute + " " + hour + " " + dayOfMonth + " " + month + " " + dayOfWeek;
            return cronString;
        },

        /**
         * Limit support consistent with front-end support as stated earlier in this module.
         * For all others, the original string will be returned
         * - Every minute : * * * * *
         * - Every hour   : ? * * * *
         * - Every day    : ? ? * * *
         * - Every week   : ? ? * * ?
         * - Every month  : ? ? ? * *
         * - Every year   : ? ? ? ? *
         */
        readableDescription : function(cronOrQuartz) {
            var cronString = methods["toCronString"].call(this, cronOrQuartz); // set initial value

            var cronType = getCronType(cronString, this.data('options'));
            if (! defined(cronType)) {
                return cronOrQuartz;
            }
            var parts = cronString.split(" ");
            var minute = parts[0], hour = parts[1], dayOfMonth = parts[2],
                month = parts[3], dayOfWeek = parts[4];
            if (cronType == "minute") {
                //"minute" : /^(\*\s){4}\*$/,                    // "* * * * *"
                return i18nMap["EveryMinute"];
            } else if (cronType == "hour") {
                //"hour"   : /^\d{1,2}\s(\*\s){3}\*$/,           // "? * * * *"
                return getLocalizedString(i18nMap["HourDesc"], {"minute": minute})
            } else if (cronType == "day") {
                //"day"    : /^(\d{1,2}\s){2}(\*\s){2}\*$/,      // "? ? * * *"
                return getLocalizedString(i18nMap["DayDesc"], {
                    "minute": getFormattedHourOrMinute(minute),
                    "hour": getFormattedHourOrMinute(hour)
                })
            } else if (cronType == "week") {
                //"week"   : /^(\d{1,2}\s){2}(\*\s){2}\d{1,2}$/, // "? ? * * ?"
                return getLocalizedString(i18nMap["WeekDesc"], {
                    "minute": getFormattedHourOrMinute(minute),
                    "hour": getFormattedHourOrMinute(hour),
                    "dow": i18nMap[days[dayOfWeek]]
                })
            } else if (cronType == "month") {
                //"month"  : /^(\d{1,2}\s){3}\*\s\*$/,           // "? ? ? * *"
                return getLocalizedString(i18nMap["MonthDesc"], {
                    "minute": getFormattedHourOrMinute(minute),
                    "hour": getFormattedHourOrMinute(hour),
                    "dom": dayOfMonth + getDaySuffix(dayOfMonth)
                })
            } else if (cronType == "year") {
                //"year"   : /^(\d{1,2}\s){4}\*$/                // "? ? ? ? *"
                return getLocalizedString(i18nMap["YearDesc"], {
                    "minute": getFormattedHourOrMinute(minute),
                    "hour": getFormattedHourOrMinute(hour),
                    "dom": dayOfMonth + getDaySuffix(dayOfMonth),
                    "month": i18nMap[months[month]]
                })
            } else {
                return cronOrQuartz;
            }
        },

        value : function(cron_str) {
            // when no args, act as getter
            if (!cron_str) { return getCurrentValue(this); }
            
            cron_str = methods["toCronString"].call(this, cron_str); // set initial value

            var o = this.data('options');
            var block = this.data("block");
            var useGentleSelect = o.useGentleSelect;
            var useBootstrapMultiSelect = o.useBootstrapMultiSelect;
            var t = getCronType(cron_str, o);
            
            if (!defined(t)) { return false; }
            
            if (defined(o.customValues) && o.customValues.hasOwnProperty(t)) {
                t = o.customValues[t];
            } else {
                var d = cron_str.split(" ");
                var v = {
                    "mins"  : d[0],
                    "hour"  : d[1],
                    "dom"   : d[2],
                    "month" : d[3],
                    "dow"   : d[4]
                };

                // update appropriate select boxes
                var targets = toDisplay[t];
                for (var i = 0; i < targets.length; i++) {
                    var tgt = targets[i];
                    if (tgt == "time") {
                        changeSelectedValue(tgt, "select.cron-time-hour", v["hour"]);
                        changeSelectedValue(tgt, "select.cron-time-min", v["mins"]);
                    } else {;
                        changeSelectedValue(tgt, "select", v[tgt]);
                    }
                }
            }
            
            // trigger change event
            var bp = changeSelectedValue("period", "select", t);
            bp.trigger("change");

            return this;

            // private util functions for cron("value") function
            function changeSelectedValue(target, selectFilter, newValue) {
                var selectField = block[target].find(selectFilter);
                if (useBootstrapMultiSelect) {
                    selectField.multiselect("select", newValue);
                    //Call rebuild, otherwise there will be two selected radio boxes somehow
                    selectField.multiselect("rebuild");
                } else {
                    selectField.val(newValue);
                    if (useGentleSelect) selectField.gentleSelect("update");
                }
                return selectField;
            }
        }
        
    };

    var event_handlers = {
        periodChanged : function() {
            var root = $(this).data("root");
            var block = root.data("block"),
                opt = root.data("options");
            var period = $(this).val();

            root.find("span.cron-block").hide(); // first, hide all blocks
            if (toDisplay.hasOwnProperty(period)) { // not custom value
                var b = toDisplay[$(this).val()];
                for (var i = 0; i < b.length; i++) {
                    block[b[i]].show();
                }
            }
        },

        somethingChanged : function() {
            root = $(this).data("root");
            // if AJAX url defined, show "save"/"reset" button
            if (defined(root.data("options").url_set)) {
                if (methods.value.call(root) != root.data("current_value")) { // if changed
                    root.addClass("cron-changed");
                    root.data("block")["controls"].fadeIn();
                } else { // values manually reverted
                    root.removeClass("cron-changed");
                    root.data("block")["controls"].fadeOut();
                }
            } else {
                root.data("block")["controls"].hide();
            }

            // chain in user defined event handler, if specified
            var oc = root.data("options").onChange;
            if (defined(oc) && $.isFunction(oc)) {
                oc.call(root);
            }
        },

        saveClicked : function() {
            var btn  = $(this);
            var root = btn.data("root");
            var cron_str = methods.value.call(root);

            if (btn.hasClass("cron-loading")) { return; } // in progress
            btn.addClass("cron-loading");

            $.ajax({
                type : "POST",
                url  : root.data("options").url_set,
                data : { "cron" : cron_str },
                success : function() {
                    root.data("current_value", cron_str);
                    btn.removeClass("cron-loading");
                    // data changed since "save" clicked?
                    if (cron_str == methods.value.call(root)) {
                        root.removeClass("cron-changed");
                        root.data("block").controls.fadeOut();
                    }
                },
                error : function() {
                    alert("An error occured when submitting your request. Try again?");
                    btn.removeClass("cron-loading");
                }
            });
        }
    };

    $.fn.cron = function(method) {
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || ! method) {
            return methods.init.apply(this, arguments);
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.cron' );
        }
    };

})(jQuery);
