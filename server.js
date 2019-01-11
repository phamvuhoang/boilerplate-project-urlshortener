'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var dns = require('dns');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGOLAB_URI);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
app.use(bodyParser.urlencoded({extended: false}));
app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});

// Create Schema and Model
var Schema = mongoose.Schema;
var shortURLSchema = new Schema({
  originalURL: String,
  shortURL: String
});

var ShortURL = mongoose.model('ShortURL', shortURLSchema);

// Helper function
function extractHostname(url) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    }
    else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    return hostname;
}

// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// I can POST a URL to [project_url]/api/shorturl/new and I will receive a shortened URL in the JSON response.
// Example : {"original_url":"www.google.com","short_url":1}
app.route('/api/shorturl/new')
.post(function(req, res) {
  // If I pass an invalid URL that doesn't follow the http(s)://www.example.com(/more/routes) format, the JSON response will contain an error like {"error":"invalid URL"}
  // HINT: to be sure that the submitted url points to a valid site you can use the function dns.lookup(host, cb) from the dns core module.
  const originalURL = req.body.url;
  dns.lookup(extractHostname(originalURL), function(err, data) {
    console.log('error:' + err);
    if (err) {
      res.json({error: 'invalid URL'});
      return;
    }
    
    // Search if url already exist
    ShortURL.findOne({originalURL: originalURL}, function(err, data) {
      if (err) {
        res.json({error: err});
        return;
      }
      
      // If URL already exist, just return the shorten url
      if (data) {
        res.json({
          original_url: data.originalURL,
          short_url: data.shortURL
        });
        return;
      }
      
      // Get max short url value in DB
      ShortURL.findOne({})
        .sort({shortURL: -1})
        .exec(function(err, data) {
          if (err) res.json({error: err});
        
          let biggestIndex = 1;
          if (data) biggestIndex = 1 + Number(data.shortURL);
        
          // Add new url/shortenURL to DB
          const shortURL = new ShortURL({
            originalURL: originalURL,
            shortURL: biggestIndex
          });
          shortURL.save(function(err, data) {
            if (err) res.json({error: err});
            res.json({
              original_url: originalURL,
              short_url: biggestIndex
            });
          });
        });
      
    });
  });
});

// When I visit the shortened URL, it will redirect me to my original link.
// [this_project_url]/api/shorturl/3 will redirect to https://.....
app.get('/api/shorturl/:id', function(req, res) {
  console.log('url id is ' + req.params.id);
  const shortURL = req.params.id;
  ShortURL.findOne({shortURL: shortURL}, function(err, data) {
    if (err) return res.json({error: err});
    
    // No url found
    if (!data) {
      return res.json({error: 'Not found'});
    }
    
    return res.status(301).redirect(data.originalURL);
  });
});

app.listen(port, function () {
  console.log('Node.js listening ...');
});