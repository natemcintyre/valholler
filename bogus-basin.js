////////////////////////////////////////////////////////////////////////////////
// NPM PACKAGES
////////////////////////////////////////////////////////////////////////////////
var phantom = require('phantom');
var cheerio = require('cheerio');
var moment = require('moment');
var twitter = require('twitter');

////////////////////////////////////////////////////////////////////////////////
// CONFIGURATION
////////////////////////////////////////////////////////////////////////////////
var url = 'http://bogusbasin.org/the-mountain/overview/conditions-webcams/';
var tinyUrl = 'https://t.co/scvdRYJMDd';

// NOTE: in order for the twitter functionality to work properly the following environment variables need to be set
//          VALHOLLER_TWITTER_CONSUMER_KEY
//          VALHOLLER_TWITTER_CONSUMER_SECRET
//          VALHOLLER_TWITTER_ACCESS_TOKEN_KEY
//          VALHOLLER_TWITTER_ACCESS_TOKEN_SECRET
var twitterClient = new twitter({
    consumer_key: process.env.VALHOLLER_TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.VALHOLLER_TWITTER_CONSUMER_SECRET,
    access_token_key: process.env.VALHOLLER_TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: process.env.VALHOLLER_TWITTER_ACCESS_TOKEN_SECRET
});

////////////////////////////////////////////////////////////////////////////////
// MAIN
////////////////////////////////////////////////////////////////////////////////
// instantiate our phantomjs server, perform the request and then process the output
logInfo('begin handling request to url: ' + url + '...');
phantom.create(['--ignore-ssl-errors=yes', '--load-images=no']).then(function (ph) {
    ph.createPage().then(function (page) {
        page.open(url).then(function (status) {
            logInfo('request status: ' + status);
            page.property('content').then(function (pageContent) {
                // request is complete, now handle processing each url with it's appropriate custom processing function
                processPageContent(pageContent);

                // close the page and exit phantom
                page.close();
                ph.exit();
            });
        });
    });
});

////////////////////////////////////////////////////////////////////////////////
// FUNCTIONS
////////////////////////////////////////////////////////////////////////////////
function processPageContent (pageContent) {
    var $ = cheerio.load(pageContent);

    var conditions = {};

    logInfo('begin parsing out data from response');

    // temperature
    conditions.temperature = $('span#conditions-now-temp').html().trim() + 'F';

    // wind
    conditions.wind =
        $('div#conditions-wind span#conditions-wind-speed').html().trim() + ' ' +
        $('div#conditions-wind span.units').html().trim().toUpperCase() + ' ' +
        $('div#conditions-wind span#conditions-wind-direction').html().trim().toUpperCase();

    // open trails
    conditions.openTrailCount = $('span#conditions-open-trails-count-open').html().trim();
    conditions.openTrailTotal = $('span#conditions-open-trails-count-total').html().trim();

    // groomed trails
    conditions.groomedTrailCount = $('span#conditions-groomed-trails-count').html().trim();
    conditions.groomedTrailTotal = $('span#conditions-groomed-trails-count-total').html().trim();

    // open lifts
    conditions.openLiftCount = $('span#conditions-lifts-count-open').html().trim();
    conditions.openLiftTotal = $('span#conditions-lifts-count-total').html().trim();

    // snow depth
    conditions.snowDepth = $('span#conditions-snow-current-depth').html().trim() + '"';

    // snow last 48 hours
    conditions.snowLast48Hours = $('span#conditions-snow-last-48').html().trim() + '"';

    // snow last 24 hours
    conditions.snowLast24Hours = $('span#conditions-snow-last-24').html().trim() + '"';

    // snow overnight
    conditions.snowOvernight = $('span#conditions-snow-overnight').html().trim() + '"';

    // output the log of all the current properties of the conditions
    logInfo('##### CONDITIONS #####');
    for (var conditionsProperty in conditions) {
        logInfo(conditionsProperty + ': ' + conditions[conditionsProperty]);
    }
    logInfo('######################');

    logInfo('finished parsing data from response');

    // some basic error handling to make sure that we got data back
    if (conditions.temperature == 'F') {
        logError('an issue occurred with the request, no value for temperature, aborting!');
        return;
    }

    // handle building the tweet and sending it to twitter
    var twitterMessage =
        '#BogusBasinConditions\n' +
        'Temp: ' + conditions.temperature + '\n' +
        'Wind: ' + conditions.wind + '\n' +
        'Snow Current: ' + conditions.snowDepth + '\n' +
        'Snow Last 24: ' + conditions.snowLast24Hours + '\n' +
        'Full Report: ' + tinyUrl
    ;

    logInfo('attempting to post tweet:\n' + twitterMessage);
    logInfo('tweet length: ' + twitterMessage.length);

    // post the tweet
    postTweet(twitterMessage);
}

////////////////////////////////////////////////////////////////////////////////
// UTILITIES
////////////////////////////////////////////////////////////////////////////////
function postTweet (tweetMessage) {
    logInfo('submitting tweet to twitter api...');
    twitterClient.post(
        'statuses/update',
        {
            status: tweetMessage
        },
        function(error, tweet, response){
            if (error) {
                logError('an issue occurred attempting to post tweet: ' + tweet);
                throw error;
            } else {
                logInfo('successfully posted tweet');
            }
        }
    );
}

function logInfo (logMessage) {
    console.log('[' + moment().format() + '][info] ' + logMessage);
}

function logError (logMessage) {
    console.log('[' + moment().format() + '][error] ' + logMessage);
}