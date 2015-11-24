var request = require('request');

var PROPERTY_CACHE = { };

var WikidataSearch = function(options) {
    this.initialize(options);
};


WikidataSearch.prototype = {

    initialize: function(options) {
        this.defaultOptions = {


            //The term you're searching for. Needs to be set before sending the search out.
            'search'                 : '',

            //The language to search in.
            'language'               : 'en',

            //Whether to disable language fallback
            'strictlanguage'         : true,

            //Search for this type of entity. Can be 'item' or 'property'.
            'type'                   : 'item',

            //Limit result count. Maximum is 50.
            'limit'                  : 7,

            //-----You probably don't want to change anything below this-----

            //The API action used to search entities
            'searchAction'                 : 'wbsearchentities',

            //The API action used to get details of entities
            'getAction'                    : 'wbgetentities',

            //The host of the API. You can change this, but you probably don't want to.
            'apiHost'                : 'www.wikidata.org',

            //The path to the API script.
            'apiPath'                : '/w/api.php'
        };

        this._setDefaultOptions(options);
    },

    _setDefaultOptions: function(options) {
        options = options || {};
        this.options = {};

        var keys = Object.keys(this.defaultOptions);
        for (var i = 0, len = keys.length; i < len; i++) {
            var index = keys[i];
            this.options[index] = (this._isUndefinedOrNull(options[index])) ? this.defaultOptions[index] : options[index];
        }
    },

    _isUndefinedOrNull: function(obj) {
        return obj === undefined || obj === null;
    },

    /**
     * Resolve properties using a batch system. Just give a list of property/value IDs, and we
     * go through 50 at a time (the API max). Once all are resolved, we activate the callback.
     *
     * @param selectedLanguage The language used to request the results.
     * @param wikidataSearch The main WikidataSearch object containing options.
     * @param propertyList List of property/value IDs to lookup.
     * @param finishedCb Activated when all finished. A function of the form: function(error);
     */
    _resolveProperties: function(selectedLanguage, wikidataSearch, propertyList, finishedCb) {

        //We can only request 50 IDs at a time.
        var trimmedList = [ ];

        //If we have more than 50 properties to lookup, take the first 50 and trim the main list.
        if (propertyList.length > 50) {
            trimmedList = propertyList.slice(0, 50);
            propertyList.splice(0, 50);
        } else {
            trimmedList = propertyList;
            propertyList = [ ];
        }

        //Construct the request URL with our ids.
        var combinedUri = 'https://' + wikidataSearch.options.apiHost + wikidataSearch.options.apiPath;
        combinedUri = combinedUri + '?action=' + wikidataSearch.options.getAction;
        combinedUri = combinedUri + '&languages=' + wikidataSearch.options.language;
        combinedUri = combinedUri + '&redirects=yes';
        combinedUri = combinedUri + '&props=labels&normalize=true';
        combinedUri = combinedUri + '&ids=' + trimmedList.join('|');
        combinedUri = combinedUri + '&format=json'; //we always want JSON back...

        //Send out the request.
        request({uri : combinedUri, method : 'GET' }, function (error, response, wikidataResponse) {

            //Make sure we have no errors.
            if (error)
                return finishedCb(error);

            if (response === undefined) {
                return finishedCb('Undefined WikiData response');
            } else if (response.statusCode === 200) {
                var propertyResult = (typeof wikidataResponse === 'string') ? JSON.parse(wikidataResponse) : wikidataResponse;

                for (var i in propertyResult.entities) {
                    var property = propertyResult.entities[i];

                    var propId = '';
                    var label = '';

                    //Get the property ID.
                    if (property.hasOwnProperty('id'))
                        propId = property.id;


                    //Make sure we have a label...
                    if (property.hasOwnProperty('labels')  && property.labels.hasOwnProperty(selectedLanguage)  && property.labels[selectedLanguage].hasOwnProperty('value'))
                        label = property.labels[selectedLanguage].value;


                    if (!propId || !label)
                        continue;

                    //Apply this property/text pair to our cache.
                    PROPERTY_CACHE[propId] = label;

                }

                if (propertyList.length > 0) //still need to resolve more properties? Keep going.
                    return wikidataSearch._resolveProperties(selectedLanguage, wikidataSearch, propertyList, finishedCb);

                return finishedCb(); //otherwise we're good. Activate the final callback.

            } else
                return finishedCb('Request error: ' + (typeof response === 'string' ? response : JSON.stringify(response)));
        });
    },

    set: function(key, value) {
        this.options[key] = value;
    },

    validateOptions: function () {

        //Make sure we have a search query...
        if (this.options.search.length == 0)
            return false;

        //Limit between 1-50 results
        if (this.options.limit > 50 || this.options.limit < 1)
            return false;

        return true;
    },

    /**
     * Perform an entity search against Wikidata using our stored options. If our options aren't
     * valid, then we immediately activate the callback with an error.
     * @param cb Callback function. Should be a function of form function(resultObject, error).
     * @returns {*}
     */
    search: function(cb) {

        if (!this.validateOptions())
            return cb({}, 'Bad options');

        var combinedUri = 'https://' + this.options.apiHost + this.options.apiPath;
        combinedUri = combinedUri + '?action=' + this.options.searchAction;
        combinedUri = combinedUri + '&language=' + this.options.language;
        combinedUri = combinedUri + '&search=' + encodeURIComponent(this.options.search);
        combinedUri = combinedUri + '&type=' + this.options.type;
        combinedUri = combinedUri + '&limit=' + this.options.limit;
        combinedUri = combinedUri + '&format=json'; //we always want JSON back...


        var requestOptions = {
            uri: combinedUri,
            method: 'GET'
        };

        //Send the response
        request(requestOptions, function (error, response, wikidataResponse) {

            //Make sure we have no errors.
            if (error)
                return cb({}, error);

            if (response === undefined) {
                return cb({}, 'Undefined WikiData response');
            } else if (response.statusCode === 200) {
                var result = (typeof wikidataResponse === 'string') ? JSON.parse(wikidataResponse) : wikidataResponse;

                //Make sure we got the results list back.
                if (!result.hasOwnProperty('search'))
                    return cb({}, wikidataResponse.errors);


                //Now lets trim some uneeded data.
                var trimmedResults = [ ];
                for (var i = 0, len = result.search.length; i < len; i++) {
                    var searchResult = result.search[i];
                    var trimmed = {};

                    if (searchResult.hasOwnProperty('url'))
                        trimmed.url = searchResult.url;
                    if (searchResult.hasOwnProperty('id'))
                        trimmed.id = searchResult.id;
                    if (searchResult.hasOwnProperty('label'))
                        trimmed.label = searchResult.label;
                    if (searchResult.hasOwnProperty('description'))
                        trimmed.description = searchResult.description;


                    if (("url" in trimmed) && ("id" in trimmed) && ("label" in trimmed))
                        trimmedResults.push(trimmed);

                }

                return cb({ 'results' : trimmedResults }, wikidataResponse.errors);
            } else
                return cb({}, 'Request error: ' + (typeof response === 'string' ? response : JSON.stringify(response)));


        });
    },

    /**
     * Clears the cache of properties used when looking up entities with property resolution enabled.
     */
    clearPropertyCache: function() {
        PROPERTY_CACHE = { };
    },

    /**
     * Perform a more detailed entity lookup for the entity IDs given in |entities|. For some
     * options like language preferences, we use the options set on construction.
     *
     * @param entities An array of entity IDs, given as strings. The IDs are Wikidata
     * identifiers, and are returned for search results in the 'search' function. For example,
     * the ID "Q47213" is for Warren Buffett. Maximum number is 50.
     *
     * @param resolveProperties If set to false, then we just return the entity properties as their
     * original Wikidata IDs. If set to true, we resolve these to plain text. We cache the property
     * text values so subsequent requests will skip lookups if possible.
     *
     * @param cb Callback function. Should be of form function(entities, error), where 'entities'
     * is the result object containing an array of results, and error will be non-empty if an error
     * occurred.
     */
    getEntities: function(entities, resolveProperties, cb) {

        var wikidataSearch = this;

        if(this._isUndefinedOrNull(entities) || Object.prototype.toString.call(entities) !== '[object Array]' )
            return cb({}, 'Bad |entities| parameter. Must be an array of strings');

        if (entities.length == 0)
            return cb({}, '');  //Not an error, just nothing to do.

        if (entities.length > 50)
            entities = entities.slice(0, 49);

        var combinedUri = 'https://' + this.options.apiHost + this.options.apiPath;
        combinedUri = combinedUri + '?action=' + this.options.getAction;
        combinedUri = combinedUri + '&languages=' + this.options.language;
        combinedUri = combinedUri + '&redirects=yes';
        combinedUri = combinedUri + '&props=claims|descriptions|labels&normalize=true';
        combinedUri = combinedUri + '&ids=' + entities.join('|');
        combinedUri = combinedUri + '&format=json'; //we always want JSON back...

        var requestOptions = {
            uri: combinedUri,
            method: 'GET'
        };

        var selectedLanguage = this.options.language;

        //Send the response
        request(requestOptions, function (error, response, wikidataResponse) {

            //Make sure we have no errors.
            if (error)
                return cb({}, error);

            if (response === undefined) {
                return cb({}, 'Undefined WikiData response');
            } else if (response.statusCode === 200) {
                var result = (typeof wikidataResponse === 'string') ? JSON.parse(wikidataResponse) : wikidataResponse;

                //If we're resolving properties to text, then we need to keep a running list of
                //properties we need to lookup. Just use a map for this.
                var combinedPropertyList = { };

                //Our list of gathered and parsed entities
                var entities = [ ];


                //Go through the returned JSON structure.
                for (var i in result.entities) {
                    var entity = result.entities[i];

                    //We want to get the label, description, and claims list for this entitiy.
                    var description = '';
                    var claims = [];
                    var label = '';

                    //Try and grab the description value.
                    if (entity.hasOwnProperty('descriptions') && entity.descriptions.hasOwnProperty(selectedLanguage))
                        description = entity.descriptions[selectedLanguage].value;

                    //And the label (name);
                    if (entity.hasOwnProperty('labels') && entity.labels.hasOwnProperty(selectedLanguage))
                        label = entity.labels[selectedLanguage].value;

                    //Now go through and get the claims.
                    if (entity.hasOwnProperty('claims')) {
                        for (var j in entity.claims) {
                            var claim = entity.claims[j];

                            //We store claims as a triplet of 'property', 'value', and 'type'. We
                            //don't go into depth with references and stuff.
                            var prop = '';
                            var val = '';
                            var propType = '';

                            for (var k in claim) {

                                var snak = claim[k];
                                //Get the main snak (value) for this claim
                                if (!snak.hasOwnProperty('mainsnak'))
                                    continue;
                                snak = snak.mainsnak;

                                //We only care about value types
                                if (snak.snaktype != 'value')
                                    continue;

                                //Get the 'property' of whatever this claim is about
                                if (snak.hasOwnProperty('property')) {
                                    prop = snak.property;
                                }


                                //Depending on the datatype, we handle the value differently. See
                                //the Wikidata API documentation for specifics.
                                if (snak.hasOwnProperty('datavalue') && snak.datavalue.hasOwnProperty('value')) {
                                    var valueType = snak.datatype;
                                    propType = valueType;

                                    //Note aboute the 'wikibase-item' type: the API says that the
                                    //conversion of the numeric-id to an entity identifier isn't
                                    //advisable, but this seems to work a vast majority of the time.
                                    if (valueType === 'wikibase-item')
                                        val = "Q" + snak.datavalue.value['numeric-id'];
                                    else if (valueType === 'string' || valueType === 'url')
                                        val = snak.datavalue.value;
                                    else if (valueType === 'time')
                                        val = snak.datavalue.time;
                                    else if (valueType === 'globe-coordinate')
                                        val = snak.datavalue.longitude.toString() + "," + snak.datavalue.latitude.toString()  //long,lat order
                                    else if (valueType === 'quantity') {
                                        val = snak.datavalue.value.amount.toString();
                                        if (snak.datavalue.value.unit != '1')   //if we have a unit, suffix it to the string.
                                            val = val + snak.datavalue.value.unit;
                                    } else
                                        continue;
                                }

                                //Did we get a valid claim? Cool, we don't care about supporting
                                // info. This is good enough.
                                if (prop && val && propType);
                                    break;
                            }

                            //We have everything we need? Push our claim onto our claim list.
                            if (prop && val && propType) {

                                //Check if we have the property identifier cached so we can skip
                                //a property lookup request. Only do this if we want to resolve the
                                //properties to text (instead of an ID).
                                var propertyCached = false;
                                var valueCached = false;

                                if (resolveProperties) {
                                    //We check both the property and value (if the type is wikibase-item)
                                    if ((prop in PROPERTY_CACHE)) {
                                        prop = PROPERTY_CACHE[prop];
                                        propertyCached = true;
                                    } else //otherwise, add to our to-do list.
                                        combinedPropertyList[prop] = 1;

                                    if (propType === 'wikibase-item') {
                                        if ((val in PROPERTY_CACHE)) {
                                            val = PROPERTY_CACHE[val];
                                            valueCached = true;
                                        } else
                                            combinedPropertyList[val] = 1;
                                    } else //not a wikibase-item? Don't touch the value then.
                                        valueCached = true;
                                }


                                //If we're not worrying about resolving properties, skip the
                                //cached flag altogether.
                                if (!resolveProperties)
                                    claims.push({'property': prop, 'value': val, 'type': propType});
                                else //otherwise, we'll need to check it later.
                                    claims.push({'property': prop, 'value': val, 'type': propType, 'propertyCached' : propertyCached, 'valueCached' : valueCached });


                            }
                        }

                    }

                    //If we have a valid label, description, and at least 1 claim, we consider this
                    // a valid entity. Save it to our list.
                    if (description && label && claims.length > 0)
                        entities.push({'label' : label, 'description' : description, 'claims' : claims });
                }

                if (!resolveProperties)
                    return cb({ 'entities' : entities }, wikidataResponse.errors);


                //Ok so now we need to go through our list of properties and get them into a text-readable
                //format so we can return human-readable results to the users. We try to cache these, so we
                //don't need to keep looking up the same properties.

                //Get the keys (Wikidata properties) from our list.
                var propertyArray = Object.keys(combinedPropertyList);

                //No properties to lookup? Cool, we're done.
                if (propertyArray.length == 0) {
                    for (var i = 0, len = entities.length; i < len; i++) {
                        for (var j = 0, claimLen = entities[i].claims.length; j < claimLen; j++) {

                            //Remove the cached properties for final output.
                            delete entities[i].claims[j].propertyCached;
                            delete entities[i].claims[j].valueCached;
                        }
                    }
                    return cb({'entities': entities}, wikidataResponse.errors);
                }

                //This will recurse through our property list in batches of 50 (the API max) until
                //all are accounted for. The PROPERTY_CACHE object is directly updated, so no
                //return values are given in the callback function.
                wikidataSearch._resolveProperties(selectedLanguage, wikidataSearch, propertyArray, function(error) {

                    if (error)
                        return cb({'error' : true, 'details' : error});

                    //Now just go through and update our entities from the global property cache.
                    for (var i = 0, len = entities.length; i < len; i++) {
                        for (var j = 0, claimLen = entities[i].claims.length; j < claimLen; j++) {

                            var propCached = entities[i].claims[j].propertyCached;
                            var valCached = entities[i].claims[j].valueCached;

                            //Remove the cached properties for final output.
                            delete entities[i].claims[j].propertyCached;
                            delete entities[i].claims[j].valueCached;

                            //If we already replaced the property of this claim with text, then skip it.
                            if (propCached && valCached)
                                continue;

                            //Now swap the IDs in the claim with the text version, if not cached
                            if (!propCached) {
                                var propertyId = entities[i].claims[j].property;
                                if (propertyId && (propertyId in PROPERTY_CACHE))
                                    entities[i].claims[j].property = PROPERTY_CACHE[propertyId];
                            }

                            if (!valCached) {
                                var valueId = entities[i].claims[j].value;
                                if (valueId && (valueId in PROPERTY_CACHE)) {
                                    entities[i].claims[j].value = PROPERTY_CACHE[valueId];
                                    //we replaced the given structure with a string, so update
                                    //the type field to reflect that.
                                    entities[i].claims[j].type = 'string';
                                }

                            }
                        }
                    }

                    return cb({'entities': entities}, wikidataResponse.errors);
                });


            } else
                return cb({}, 'Request error: ' + (typeof response === 'string' ? response : JSON.stringify(response)));


        });
    }
};

exports.WikidataSearch = WikidataSearch;

