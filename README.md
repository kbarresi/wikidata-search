wikidata-search
===============

Perform easy entity searches using Wikidata as a source.

What's an entity search? Basically, just give an entity name (person, place, thing, etc), and 
we'll run a query against the Wikidata API. We'll match it to the Wikidata entity that most 
closely matches what you searched, and return a bunch of structured data for that entity. For a
better idea of what this means, check out some of the examples below.


## Installation

  npm install wikidata-search
  
 
## Overview

wikidata-search provides two major functionalities: the ability to search for entities based on 
given (possibly incomplete) text, and the ability to get more detailed information about entities 
from their IDs. All of this is done is a clean way that (mostly) abstracts you from the headache
that is Wikidata. 

## Usage 

    //First, create a new Wikidata Search object.
    var WikidataSearch = require('wikidata-search').WikidataSearch;
    var wikidataSearch = new WikidataSearch();
    
    //To search:
    wikidataSearch.set('search', <SOMETHING'S NAME>); //set the search term
    wikidataSearch.search(function(result, error) {
   
        //check the 'error' parameter for any errors, and your results are in 'result'.
    });
    
    
    //To get detailed info on one or more entities:
    wikidataSearch.getEntities(['id', 'id', ...], true, function(result, error) {
        //check the 'error' parameter for any errors, and your results are in 'result'.
    });
    
    
## Important Functions


### WikidataSearch.set(key, value) 

Sets an option *key* to *value*.
    
### WikidataSearch.search(callback) 

Performs a search using the 'search' option (which should be set using 
WikidataSearch.set(key, value). The data returned has the following format:

    results : {   
        id : {String}, the ID of the result entity,
        url : {String}, the Wikidata URL for the entity,
        label : {String}, the string label for the entity (its name),
        description : {String}, the optional description of the entity, if available
    }
    
The `description` field is only available for entities (i.e. not properties).

### WikidataSearch.getEntities(entityIdList, resolveProperties, callback) 
    
Get detailed information for a list of entities who's IDs (strings) are listed in *entityIdList*.
The *resolveProperties* parameter determines whether the results have their property and value IDs
replaced with the corresponding labels (names) of the entities and properties. The result field will
look something like this:

    [ 
        { 
            label: 'New York Mets',
            description: 'baseball team and Major League Baseball franchise in Queens, New York, United States',
            claims: [ 
                { value: 'New York Mets', type: 'string', property: 'Commons category' },
                { value: 'Citi Field', type: 'string', property: 'home venue' },
                { value: 'Terry Collins', type: 'string', property: 'head coach' },
                { value: 'Major League Baseball', type: 'string', property: 'league' },
                { value: 'baseball team', type: 'string', property: 'instance of' },
                { value: 'Category:New York Mets', type: 'string', property: 'topic\'s main category' },
                { value: '/m/05g76', type: 'string', property: 'Freebase identifier' },
                { value: '134873843', type: 'string', property: 'VIAF identifier' },
                { value: 'baseball', type: 'string', property: 'sport' },
            ] 
        },
    ]
    
About the fields: *label* is a text label, and generally gives the name of the entity. *description*
is a text description of the entity. *claims* is a list of facts about the entity, given as 
property/value/type triplets.



A bit about the *resolveProperties* parameter: say a lookup result has a claim looking like this: 

    { 'property' : 'P1234', 'value' : 'Q1234', 'type' : 'wikidata-item' }
    
If property resolution is disabled (set to false), then that's exactly what you'll get back. If it's 
enabled, then we'll do a lookup for `P1234` and `Q1234`, and replace those IDs with their labels. So
it might look something like this if property resolution is enabled. Notice that the `type` field is
updated:

    { 'property' : 'is parent of', 'value' : 'Jim Bob', 'type' : 'string' }
    
Unfortunately, property resolution means it'll probably have to do two requests behind the scenes: one
to get the entity result, and another to populate the the properties with their labels. There's 
good news though! We cache these lookups, so once a property ID is resolved to a label, it's saved 
in memory. To clear the cache, use WikidataSearch.clearPropertyCache();
    
    
## Examples

See example.js for an example of how to use this.