//Loading required packages
var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");

//connecting to wit.ai
var wit = wit.connect(process.env.WIT_TOKEN);

//connection to mongodb
var db = mongoose.connect(process.env.MONGODB_URI);

var Movie = require("./models/movie");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

// Server index page
app.get("/", function (req, res) {
    res.send("App deployed!");
});

////////////////////////////////////////////////////////////////////////
//Title: Messenger Platform samples for sending and receiving messages.
//Author: Peter Chang
//Date: 28 Oct 2016
//Availability: https://github.com/fbsamples/messenger-platform-samples
////////////////////////////////////////////////////////////////////////

// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
    if (req.search_mv["hub.verify_token"] === process.env.VERIFICATION_TOKEN) 
    {
        console.log("Webhook verified");
        res.status(200).send(req.search_mv["hub.challenge"]);
    } 
    else {
        console.error("Not verified. Unknown token.");
        res.sendStatus(403);
    }
});


////////////////////////////////////////////////////////////////////////
//Title: Messenger Platform samples for sending and receiving messages.
//Author: Peter Chang
//Date: 28 Oct 2016
//Availability: https://github.com/fbsamples/messenger-platform-samples
////////////////////////////////////////////////////////////////////////

// Messenger postback
app.post("/webhook", function (req, res) {
    // Checking if its a page subscription
    if (req.body.object == "page") 
    {
        // Iterating over each entry
        req.body.entry.forEach(function(entry) 
        {
            // Iterating over each messaging event
            entry.messaging.forEach(function(event) 
            {
                if (event.postback) 
                {
                    processPostback(event);
                } else if (event.message) 
                {
                    processMsg(event);
                }
            });
        });

        res.sendStatus(200);
    }
});

////////////////////////////////////////////////////////////////////////
//Title: Messenger Platform samples for sending and receiving messages.
//Author: Peter Chang
//Date: 28 Oct 2016
//Availability: https://github.com/fbsamples/messenger-platform-samples
////////////////////////////////////////////////////////////////////////

function processPostback(event) 
{
    var sender_id = event.sender.id;
    var payload = event.postback.payload;

    if (payload === "Greeting") 
    {
        // Fetching user's first name from the User Profile API
        // and send a customised greeting message       
        request({
            url: "https://graph.facebook.com/v2.6/" + sender_id,
            qs: {
                access_token: process.env.PAGE_ACCESS_TOKEN,
                wit: {wit_token: process.env.WIT_TOKEN},
                contexts: "first_name"
            },
            method: "GET"
        }, function(error, response, body) 
        {
            var greeting = "";
            if (error) 
            {
                console.log("Cannot get user's name: " +  error);
            } else {
                var body_user = JSON.parse(body);
                name = body_user.first_name;
                greeting = "Hey " + name + "! ";
            }
            var message = greeting + "My name is Nudgie Bot. 🤖 I can tell you various details regarding movies. 🎬 What movie would you like to know about today? 🤔";
            sendMsg(sender_id, {text: message});
        });
    } 

    else if (payload === "Correct") 
    {
        sendMsg(sender_id, {text: "Interesting choice! 😊 So, what would you like to know about the movie? You can ask me about 'Plot', 'Genre', 'Date', 'Runtime', 'Director', 'Writer', 'Cast', 'Awards' or 'Rating'."});
    } else if (payload === "Incorrect") 
    {
        sendMsg(sender_id, {text: "Whoops! Sorry I couldn't find the movie. 🙁 Try again with exact title of the movie. 👍🏽"});
    }
}

function processMsg(event) 
{
    if (!event.message.is_echo) 
    {
        var message = event.message;
        var sender_id = event.sender.id;

        console.log("New message from: " + sender_id);
        console.log("Message: " + JSON.stringify(message));

        // You may get a text or attachment but not both
        if (message.text) 
        {

            //formatting user's message to lowercase
            var msgFormat = message.text.toLowerCase().trim();

            // Checking if the received message matches any of the following criteria
            // If no one of the criteria matches, it searches for a new movie.
            switch (msgFormat) 
            {
                case "plot":
                case "date":
                case "runtime":
                case "director":
                case "cast":
                case "rating":
                case "genre":
                case "writer":
                case "awards":
                    getMovieDetail(sender_id, msgFormat);
                    break;

                default:
                    getMovie(sender_id, msgFormat);
            }
            // If the bot receives voice message of attachments instead of text message
            // it asks the user to try again
        } else if (message.attachments) {
            sendMsg(sender_id, {text: "Sorry! I can only process text messages. Please try again! 😵"});
        }
    }
}

// fetch the requested movie name from the OMDB API
function getMovie(user_id, movieTitle) 
{
    request("http://www.omdbapi.com/?type=movie&t=" + movieTitle, function (error, response, body) {
        if (!error && response.statusCode == 200) 
        {
            var movie_name = JSON.parse(body);
            if (movie_name.Response === "True") 
            {
                var search_mv = {user_id: user_id};
                //searching for the requested detail from the database
                var update_mv = {
                    user_id: user_id,
                    //gets the movie title
                    title: movie_name.Title,    
                    //returns the movie plot
                    plot: movie_name.Plot,
                    //gets the relase date       
                    date: movie_name.Released,  
                    //gets the runtime
                    runtime: movie_name.Runtime,    
                    //fetches the director's name
                    director: movie_name.Director,  
                    //gets the movie cast
                    cast: movie_name.Actors,        
                    //the movie's IMDB rating
                    rating: movie_name.imdbRating,  
                    //fetches the movie's genre
                    genre: movie_name.Genre,        
                    //gets the movie's writers
                    writer: movie_name.Writer,      
                    //gets the awards won by the movie
                    awards: movie_name.Awards, 
                    //gets the movie poster 
                    poster_url:movie_name.Poster
                };
                var user_con = {upsert: true};
                Movie.findOneAndupdate_mv(search_mv, update_mv, user_con, function(err, mov) 
                {
                    if (err) {
                        console.log("Database error: " + err);
                    } else {
                        //Asking for user's confirmation for the search result
                        message = {
                            attachment: {
                                type: "template",
                                payload: {
                                    template_type: "generic",
                                    elements: [{
                                        title: movie_name.Title,
                                        subtitle: "There you go! I found this movie. Is this what you are looking for? 🤔",
                                        image_url: movie_name.Poster === "N/A" ? "http://placehold.it/350x150" : movie_name.Poster,
                                        buttons: [{

                                            //If the user selects yes, it asks for further movie details
                                            type: "postback",
                                            title: "Yes 😃",
                                            payload: "Correct"
                                        }, {
                                            type: "postback",
                                            title: "No 😐", //If the user selects no, it asks the user to try again
                                            payload: "Incorrect"
                                        }]
                                    }]
                                }
                            }
                        };
                        sendMsg(user_id, message);
                    }
                });
            } else {
                console.log(movie_name.Error);
                sendMsg(user_id, {text: movie_name.Error});
            }
        } else {
            sendMsg(user_id, {text: "Oopsie! Looks like omething went wrong. Please try again! 😣"});
        }
    });
}

// Gets the user requested movie details
function getMovieDetail(user_id, context) {
    Movie.findOne({user_id: user_id}, function(err, movie) 
    {
        if(err) 
        {
            sendMsg(user_id, {text: "Oopsie! Looks like something went wrong. Please try again! 😣"});
        } else {
            sendMsg(user_id, {text: movie[context]});
        }
    });
}

// sends message to user
function sendMsg(recipient_id, message) {
    request({
        url: "https://graph.facebook.com/v2.6/me/messages",
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        wit: {wit_token: process.env.WIT_TOKEN},
        method: "POST",
        json: {
            recipient: {id: recipient_id},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log("Error sending message: " + response.error);
        }
    });
}

