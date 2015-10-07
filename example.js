var WikidataSearch = require('./lib/wikidata-search.js').WikidataSearch;
var wikidataSearch = new WikidataSearch();  //You can set options here, or using the 'set' function.

//So we can inspect results.
var util = require('util');

//Lets search Wikidata for the Mets. Set the search term like this, or do it in the constructor.
wikidataSearch.set('search', 'New York Mets');

//Now lets perform the search.
wikidataSearch.search(function(result, err) {

    //Check for errors.
    if (err) {
        console.log('Uh oh, we got an error! : ' + err);
        return;
    }


    //The results are an array of entities, containing an ID, url,
    // label, and (possibly) description. Lets take a look at what we got back.
    console.log(util.inspect(result, true, null));


    //Lets take the first result, and do some more research on it.
    var entityId = result.results[0].id;

    //We feed it an array of entity IDs. The second parameter says to do property resolution, so
    //instead of getting a chain of entity and property IDs back in the results, it will give back
    //the text labels of these things.
    //
    // E.g Say a lookup result is: { 'property' : 'P1234', 'value' : 'Q1234', 'type' : 'wikidata-item' }
    // If entity resolution is turned off, then that's what you'll get back. If it's enabled, then
    // we'll do a lookup for P1234 and Q1234, and replace those values with their labels. So it
    // might look something like { 'property' : 'is parent of', 'value' : 'Jim Bob', 'type' : 'string' }
    // Notice that we updated the 'type' field.
    wikidataSearch.getEntities([entityId], true, function(result, err) {
        //Check for errors.
        if (err) {
            console.log('Uh oh, we got an error! : ' + err);
            return;
        }

        //Now let's look at the cool info we go back. Pretty cool, and pretty quick!
        console.log(util.inspect(result, true, null));
    });

});
