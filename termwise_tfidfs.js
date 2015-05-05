var AWS = require('aws-sdk');
var hl = require('highland');
var crypto = require('crypto');
var async = require('async');
var fs = require('fs');

var s3 = new AWS.S3();

var sha1 = function (input) {
    var str = crypto.createHash('sha1').update(input).digest('hex');
    while (str.charAt(0) === '0') {
      str = str.substring(1);
    }
    return str;
};

var idx = 0, errors = 0;

// Each line in each file
// Split by tab
// First item is term; hash this and it becomes filename
// Store the remainder as the contents of that file
// write everything to /ec2_data
var folder_name = 'inverted-index-merged';
var listObjectsParams = {Bucket: 'cis555-bucket', Prefix: folder_name + '/part-r'};
// WARNING: Change if you run this again!
var output_dir = 'ec2-data/tfidfs_out_2/';
require('mkdirp').sync(output_dir);



var worker = function (line, next) {
  var tabIndex = line.indexOf('\t');
  if (tabIndex === -1) {
    console.log('No tab char for ' + line.substring(0, 50));
    console.log('ignoring...');
    next();
  } else {
    var filename = output_dir + sha1(line.substring(0, tabIndex));
    fs.writeFileSync(filename, line, {flag: 'w'});
    if (idx % 10000 === 0) {
      console.log('Processed ' + idx + ' terms with ' + errors + ' errors.');
    }
    idx++;
    next();
  }
};

s3.listObjects(listObjectsParams, function (_err, s3objects) {
  var contentIdx = -1;
  console.log(s3objects.Contents);
  var q = async.queue(worker, 100);
  q.drain = function () {
    if (contentIdx === s3objects.Contents.length) {
      console.log(idx + ' items processed with ' + errors + ' errors');
    } else {
      contentIdx++;
      console.log('Considering file ' + contentIdx);
      var getObjectParams = {Bucket: 'cis555-bucket', Key: s3objects.Contents[contentIdx].Key};
      hl(s3.getObject(getObjectParams).createReadStream()).split().toArray(function (array) {
        console.log('created an array of length ' + array.length);
        q.push(array);
      });
    }
  };
  q.push([]);
});
