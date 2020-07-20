var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var gailIndexRouter = require('./routes/gail/index');
var gailUsersRouter = require('./routes/gail/users');
var gailAdminRouter = require('./routes/gail/admin');
var gailProjectRouter = require('./routes/gail/projects');

var contractorBidsRouter = require('./routes/contractors/bids');
var contractorUsersRouter = require('./routes/contractors/users');
var contractorAdminRouter = require('./routes/contractors/admin');

const cors = require('./cors');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/gail', gailIndexRouter);
app.use('/gail/users', gailUsersRouter);
app.use('/gail/admin', gailAdminRouter);
app.use('/gail/project', gailProjectRouter);

app.use('/contractors/bids', contractorBidsRouter);
app.use('/contractors/users', contractorUsersRouter);
app.use('/contractors/admin', contractorAdminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
