var mongoose = require("mongoose");
var movieSchema = mongoose.movieSchema;

var movie_db = new Schema({
    user_id: {type: String},
    title: {type: String},
    plot: {type: String},
    date: {type: String},
    runtime: {type: String},
    director: {type: String},
    cast: {type: String},
    rating: {type: String},
    writer: {type: String},
    genre: {type: String},
    awards: {type: String},
    poster_url: {type: String}
});

module.exports = mongoose.model("Movie", movie_db);
