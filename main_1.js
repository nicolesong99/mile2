const express = require('express')
// for solving relative path problem
const path = require('path')
// for html parsing
const bodyParser = require('body-parser')
const multer = require('multer')
// for managing files system, like delete
const fs = require('fs')
// for connecting db
const mongoose = require('mongoose')
// Generate ID for mongodb id
const shortId = require('shortid')
// for sending key to email
const nodemailer = require('nodemailer')
// for cookie
const session = require('express-session')
// get unixTime
// const unixTime = require('unix-time')
// for keeping uploaded files
const upload_dir = path.join(__dirname + '/uploads/')
const upload = multer({ dest: upload_dir })
// Create an Application based on ExpressJS
const app = express()

/** ***************************** Connect to MongoDB -- mongoose ********************/
// Get Mongoose to use the gloabl promise library
mongoose.Promise = global.Promise
// set up default mongoose connection -- localhost/ 127.0.0.1
// mongoose.connect('mongodb://localhost:27017/project', { useNewUrlParser: true, useCreateIndex: true })
mongoose.connect('mongodb://64.52.86.214:27017/project', { useNewUrlParser: true, useCreateIndex: true })

/** ****************************** Application Configuration PARTS ******************************/
app.use(express.static(path.join(__dirname, 'public')))
app.use(bodyParser.json()) // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // to support URL-encoded bodies
  extended: true
}))

app.set('view engine', 'ejs')
// for getting ip for viewing questions
app.set('trust proxy')
// configuration about cookies
app.use(session({
  secret: 'cheryl',
  resave: false,
  saveUninitialized: true
}))

var externalip = require('external-ip')

/** ******************************************** Database settings *********************************************/
// Create & Define a schema for 'User'
// User -- Question: one to many
// User -- Answer : one to many
const userSchema = new mongoose.Schema({
  // default --- ObjectID
  id: { type: String, unique: true, default: shortId.generate },
  username: { type: String, required: true, unique: [true, 'username must be unique'] }, // username must be unique
  email: { type: String, required: true, unique: [true, 'email must be unique'] }, // email must be uniqeu
  password: { type: String, required: true },
  reputation: { type: Number, default: 1 },
  verify: { type: Boolean, default: false },
  key: { type: String, default: 'abracadabra' }
})
// Create User module for the created schema
const User = mongoose.model('User', userSchema)

// Create & Define a schema for 'Answer'
// Question -- Answer : one to many
const answerSchema = new mongoose.Schema({
  // default --- ObjectID
  id: { type: String, required: true, unique: true, default: shortId.generate },
  question_id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  body: { type: String, required: true },
  upvote: [ { type: String } ],
  downvote: [ { type: String } ],
  is_accepted: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  media: [ { type: String } ] // answer's media (array) ---save filename(media's id)
})
// Create Answer module for the created schema
const Answer = mongoose.model('Answer', answerSchema)

// Create & Define a schema for 'Question'
const questionSchema = new mongoose.Schema({
  // default --- ObjectID
  id: { type: String, unique: true, default: shortId.generate },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // question's poster
  title: { type: String, required: true }, // question's title
  body: { type: String, required: true }, // question's body
  tags: [ { type: String } ], // question's tags(array)
  media: [ { type: String } ], // question's media(array)
  upvote: [ { type: String } ], // user_id
  downvote: [ { type: String } ], // user_id
  timestamp: { type: Date, default: Date.now },
  viewers: [ { type: String } ], // question's viewers(users)' id or ip address
  answers: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Answer' } ],
  accepted_answer: { type: String, require: true, default: null } // answer's id
})
// Create Question module for the created schema
const Question = mongoose.model('Question', questionSchema)

/** *************************** Use nodemailer for verfying email ********************/
var smtpTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'cheryl123liu@gmail.com', // your gmail
    pass: '630future52mm' // your password
  }
})

/** *********************************** Global variable & helper methods ************************************/
var mailOptions, host, link // for sending mail
var mySession // for cookie-based system
var backdoor = 'abracadabra' // backdoor key for verifying user account

/** ************************************* GET && POST methods ************************************/
app.get(['/', 'index'], (req, res) => {
  console.log('upload_dir is: %s', upload_dir)
  console.log('client ip is: %s', req.ip)

  res.send('Welcome, This is my homepage for CSE356 Stackover Flow Clone')
})
// UI for '/adduser' --- not in hw
app.get('/adduser', (req, res) => {
  res.render(path.join(__dirname, 'public/ejs/create'))
})

// UI for verification --- not in hw
app.get('/verify', (req, res) => {
  res.render(path.join(__dirname, 'public/ejs/verify'))
})

// UI for login  --- not in hw
app.get('/login', (req, res) => {
  mySession = req.session
  if (mySession.username) { // check if logged user
    // Go to questions page
    res.redirect('/questions')
  } else { // need to login in
    res.render(path.join(__dirname, 'public/ejs/login'))
  }
})

// UI for questions, not in hw
app.get('/questions', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    var allMedia = fs.readdirSync(upload_dir)
    console.log("allMedia's length: %d\n", allMedia.length)
    res.render(path.join(__dirname, 'public/ejs/questions'), { name: mySession.username, allMedia: allMedia })
  } else {
    res.render(path.join(__dirname, 'public/ejs/questions'), { name: null, allMedia: [] })
  }
})

// UI for answers -- not in hw
app.get('/questions/answers', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    var allMedia = fs.readdirSync(upload_dir)
    console.log("allMedia's length: %d \n", allMedia.length)
    res.render(path.join(__dirname, 'public/ejs/answers'), { name: mySession.username, allMedia: allMedia })
  } else {
    res.render(path.join(__dirname, 'public/ejs/answers'), { name: null, allMedia: [] })
  }
})

// UI for media -- not in course project
app.get('/media', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    res.render(path.join(__dirname, 'public/ejs/media'))
  } else {
    res.redirect('/login')
  }
})

/**
  * /adduser ----POST
  * user&email must be unique
  * return: {status:'OK'} or {status: 'error', error: ..}}
**/
app.post('/adduser', async (req, res) => {
  // Instantiate one user object with json data
  var newUser = new User({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password
  })

  await newUser.save().then(item => {
    // send email with the key
    host = req.get('host')
    link = 'http://' + host + '/verify?email=' + req.body.email + '&key=' + backdoor
    console.log('in /adduser ---> The link is: %s\n', link)
    mailOptions = {
      to: req.body.email,
      subject: 'Email Confirmation',
      text: 'validation key: &#60' + backdoor + '&#62',
      html: '<h3>This is the email for making verification with the backdoor key.  <br>The validation key: &#60' + backdoor + '&#62 </p><br> <p> Please Click on the following link to verify your email <p><br> <a href=' + link + '>Click here to verify, please</a>'
    }

    smtpTransport.sendMail(mailOptions, function (error, response) {
      if (error) {
        console.log('in /adduser ---> failed to send mail: %s\n', JSON.stringify(error))
        // remove just created user
        User.findOneAndRemove({ username: req.body.username }, function (error_1) {
          if (error_1) {
            res.json({ status: 'error', error: JSON.stringify(error_1) })
          }
        })
        res.json({ status: 'error', error: JSON.stringify(error) })
      } else {
        res.json({ status: 'OK' })
      }
    })
  }).catch(err => {
    console.log(JSON.stringify(newUser))
    res.json({ status: 'error', error: JSON.stringify(err) })
  })
})

/**
  * Verify the created user ----POST
  * return: {status:'OK'} or {status: 'error', error: 'error message'}}
**/
app.post('/verify', (req, res) => {
  // abracadabra
  User.updateOne({ email: req.body.email, key: req.body.key }, { $set: { verify: true } })
    .then((docs) => {
      // find the specify user and make some modification
      console.log(' /verify after updating--> docs: %s\n', JSON.stringify(docs))
      if (docs.n > 0 || docs.nModified > 0) {
        // modified the user
        res.json({ status: 'OK' })
      } else {
        // the user does not exit or already verified
        res.json({ status: 'error', error: 'the user does not exist or already verified' })
      }
    }).catch((err) => {
      res.json({ status: 'error', error: JSON.stringify(err) })
    })
})

/**
  * Login to account & start the session  /login---POST
  * return: {status:'OK'} or {status: 'error', error: 'error message'}}
**/
app.post('/login', async (req, res) => {
  mySession = req.session
  await User.findOne({
    username: req.body.username,
    password: req.body.password,
    verify: 'true'
  }).then((doc) => {
    if (doc == null) {
      res.json({ status: 'error', error: 'no active user founded!' })
    } else {
      mySession.username = req.body.username
      mySession.user = doc
      res.json({ status: 'OK' })
    }
  }).catch((err) => {
    res.json({ status: 'error', error: JSON.stringify(err) })
  })
})

/**
  * Logout  /logout----POST
  * return: {status:'OK'} or {status: 'error', error: 'error message'}}
**/
app.post('/logout', (req, res) => {
  req.session.destroy(function (err) {
    if (err) {
      res.json({ status: 'error', error: JSON.stringify(err) })
    } else {
      res.json({ status: 'OK' })
    }
  })
})

/** ************************************ Main(Questions/Answers) Parts **************************************/
/**
  * /questions/add ----POST
  * return: {status:'OK', id: 'unique question id string'} or {status: 'error', error: 'error message'}}
**/
app.post('/questions/add', (req, res) => {
  mySession = req.session
  if (mySession.username) { // if authenticiated user
    var newQuestion = new Question({
      user: mySession.user._id,
      title: req.body.title,
      body: req.body.body,
      tags: req.body.tags,
      media: req.body.media
    })
    console.log("questions/add: newQuestion's struct-->%s \n", newQuestion)

    newQuestion.save().then(item => {
      res.json({ status: 'OK', id: JSON.stringify(newQuestion.id) })
    }).catch(err => {
      res.json({ status: 'error', error: JSON.stringify(err) })
    })
  } else {
    // Need to login firstly
    res.json({ status: 'error', error: 'need to login firstly to post a new question' })
  }
})

/**
  * /questions/{id}----POST
  * return: {
          status:'OK',
          question: {
                id: string
                user: {
                id: string
                username: string
                reputation: int
                },
          body: string,
          score: int,
          view_count: int,
          answer_count: int,
          timestamp: timestamp, represented as Unix time,
          media: array of associated media IDs,
          tags: array of tags,
          accepted_answer_id: id of accepted answer, if there exists one. Null otherwise
                'unique question id string'} or {status: 'error', error: 'error message'}
    }

    * Or error: error message (if error)
**/
app.get('/questions/:id', async (req, res) => {
  mySession = req.session
  var viewerID
  // views are unique by authenticated users, and for unauthenciated ip
  if (mySession.username) {
    viewerID = mySession.user.id
  } else {
    viewerID = req.ip
  }
  console.log('/questions/{id}-->get viewerID: %s\n', viewerID)

  // $addToSet --avoid duplicated to add data in array
  await Question.findOneAndUpdate({ id: req.params.id }, { $addToSet: { viewers: viewerID } }).populate('user').exec(function (err, doc) {
    if (err) {
      res.json({ status: 'error', error: JSON.stringify(err) })
    } else { // Find the question
      console.log('question detail: %s\n', doc)
      if (doc == null) {
        res.json({ status: 'error', error: 'did not find the question you want to view' })
      } else {
        // find the question to view --- status: OK
        // console.log('timestamp in Math: %s', Math.round((questionObj.timestamp).getTime() / 1000))
        var score = doc.upvote - doc.downvote
        console.log('question: default score %s\n', score)
        var viewers = doc.viewers
        if (doc.viewers.indexOf(viewerID) < 0) {
          viewers.push(viewerID)
        }
        var question = {
          id: doc.id,
          user: {
            username: doc.user.username,
            reputation: doc.user.reputation
          },
          title: doc.title,
          body: doc.body,
          score: score,
          view_count: doc.viewers.length,
          anwer_count: doc.answers.length,
          timestamp: Math.round((doc.timestamp).getTime() / 1000),
          media: doc.media,
          tags: doc.tags,
          accepted_answer_id: doc.accepted_answer
        }

        console.log('/questions/{id} get---> question need to be returned: %s\n', JSON.stringify(question))
        res.json({ status: 'OK', question: question })
      }
    }
  })
})

/*
*  Delete Question -- POST
* return HTTP status code
*/
app.delete('/questions/:id', async (req, res) => {
  mySession = req.session
  if (mySession.username) {
    // Should only succeed deleting if logged in user is original asker
    await Question.findOneAndRemove({ id: req.params.id }).populate('answer').exec(async function (err, doc) {
      if (err) {
        console.log('find and remove question with error: %s\n', JSON.stringify(err))
        res.status(400).send({ status: 'error', error: JSON.stringify(err) })
      } else {
        if (doc == null) {
          res.status(204).send({ status: 'error', error: 'without content, cannot to delete it' })
        } else {
          // find one question with specified id
          if (!(doc.user).equals(mySession.user._id)) { res.status(203).send({ status: 'error', error: 'you are not the original asker of the question, cannot to delete it' }) }

          // remove answers and its related media
          var answers = doc.answers
          if (answers.length > 0) {
            var answers_mediaPath
            console.log(answers_media)
            answers.forEach(function (ele, index) {
              console.log(ele)
              answers.forEach(function (ele_1, index_1) {
                answers_mediaPath = path.join(upload_dir, ele_1)
                console.log('answers_mediaPath: %s ; ', mediaPath)
              })
              if (answers_mediaPath) {
                fs.unlinkSync(answers_mediaPath, function (remove_err) {
                  if (remove_err) { res.status(400).send({ status: 'error', error: JSON.stringify(remove_err) }) }
                })
              }
            })

            await Answer.remove({ _id: { $in: answers } }, (err_1, data) => {
              if (err_1) {
                res.status(400).send({ status: 'error', error: JSON.stringify(err_1) })
              }
            })
          }
        }

        // Remove related media files for question
        var media = doc.media // filename
        if (media.length > 0) {
          var mediaPath
          media.forEach(function (ele, index) {
            mediaPath = path.join(upload_dir, ele)
            console.log('mediaPath: %s ; ', mediaPath)
          })

          fs.unlinkSync(mediaPath, function (remove_err) {
            if (remove_err) { res.status(400).send({ status: 'error', error: JSON.stringify(remove_err) }) }
          })
        }
        console.log('pass to delete question')
        res.status(200).send({ status: 'OK' })
      }
    })
  } else {
    res.status(203).send({ status: 'error', error: 'to delete the question, you need to login firstly' })
  }
})

/** **************************************************** Answers Parts **************************************/
/*
Returns
status: “OK” or “error”
id: unique answer ID string (if OK)
error: error message (if error)
*/
app.post('/questions/:id/answers/add', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    var question_id = req.params.id
    var newAnswer = new Answer({
      question_id: question_id,
      body: req.body.body,
      user: mySession.user._id,
      media: req.body.media
    })

    newAnswer.save().then(item => {
      console.log('Save a answer successfully! id: %s\n', item.id)
    }).catch(err => {
      res.json({ status: 'error', error: JSON.stringify(err) })
    })

    console.log("questions/{id}/answers/add: New Answer's struct-->%s \n ", newAnswer)

    Question.findOneAndUpdate({ id: question_id }, { $addToSet: { answers: newAnswer._id } }).exec(function (err, doc) {
      if (err) {
        // remove just created answer
        Answer.findOneAndRemove({ id: newAnswer.id }, function (err_1) {
          if (err_1) {
            res.json({ status: 'error', error: JSON.stringify(err_1) })
          }
        })
        res.json({ status: 'error', error: JSON.stringify(err) })
      } else {
        // Find the question adn update
        console.log('find the question in detail : %s\n', doc)
        if (doc == null) {
          Answer.findOneAndRemove({ id: newAnswerID }, function (err_1) {
            if (err_1) {
              res.json({ status: 'error', error: JSON.stringify(err_1) })
            }
          })
          res.json({ status: 'error', error: 'did not find the question to add the new answer' })
        } else { res.json({ status: 'OK', id: newAnswer.id }) }
      }
    })
  } else {
    res.json({ status: 'error', error: 'you need to log in firstly to post a new answer' })
  }
})

/*  /questions/{id}/answers --- GET
 * returns: {
    status: 'OK',
    answers:[
    {
        id: string
        user: id of poster
        body: string
        score: int
        is_accepted: boolean
        timestamp: timestamp, represented as Unix time
        media: array of asociated media IDs
    }
    ]
}
or
return {
    status: “error”
    error: error message
}
*/
app.get('/questions/:id/answers', async (req, res) => {
  console.log('/questions/:id/answers')
  await Question.findOne({ id: req.params.id })
    .populate({ path: 'answers' })
    .exec(async function (err, doc) {
      if (err) {
        res.json({ status: 'error', error: JSON.stringify(err) })
      } else {
        if (doc == null) {
          res.json({ status: 'error', error: 'did not find the qiestion with id: ' + req.params.id })
        } else {
          // find the question with specified id
          var answersObj = doc.answers// array of asnwers obj
          console.log('answersObj: %s\n', JSON.stringify(answersObj))
          var return_answers = []
          for (var i = 0; i < answersObj.length; i++) {
            var username = await User.findOne({ _id: answersObj[i].user }, 'username', function (err_1, user) {
              if (err) {
                res.json({ status: 'error', error: JSON.stringify(err_1) })
              }
              return user.username
            })
            var ele_answer = {
              id: answersObj[i].id,
              user: username,
              body: answersObj[i].body,
              score: answersObj[i].upvote.length - answersObj[i].downvote.length,
              is_accepted: answersObj[i].is_accepted,
              timestamp: Math.round((answersObj[i].timestamp).getTime() / 1000),
              media: answersObj[i].media
            }
            return_answers.push(ele_answer)
          }
          res.json({ status: 'OK', answers: return_answers })
        }
      }
    })
})

/*
  * Gets a list of the lastest {limit } number of questions prior to (and including) the provided (timestamp)
  return {status: 'OK', user:{ email: string, reputation: int }}} or {status:'error', error:}
  *
*/
app.post('/search', async (req, res) => {
  var timestamp = req.body.timestamp // number
  var limit = req.body.limit // number
  var query = req.body.q // string
  var sort_by = req.body.sort_by // string
  var tags = req.body.tags // array
  var has_media = req.body.has_media // boolean
  var accepted = req.body.accepted // boolean

  var all_questions // get all questions firstly
  Question.find({}).populate('user').exec(function (err, docs) {
    if (err) {
      res.json({ status: 'error', error: JSON.stringify(err) })
    } else {
      var all_questions = docs

      console.log('all_questions: %s\n', JSON.stringify(all_questions))
      // sort questions
      var return_questions = []
      if (all_questions.length > 0) {
        if (sort_by == 'score') {
          all_questions.sort((a, b) => ((a.upvote.length - a.downvote.length) > (b.upvote.length - b.downvote.length)) ? 1 : -1)
        } else {
          all_questions.sort((a, b) => (a.timestamp > b.timestamp) ? 1 : -1)
        }

        var count_question = 0
        var i
        for (i = 0; i < all_questions.length; i++) {
          var ele = all_questions[i]
          // from this time and earlier
          console.log('here')
          console.log(Math.round((ele.timestamp).getTime() / 1000))
          console.log(timestamp)
          if (Math.round((ele.timestamp).getTime() / 1000) > timestamp) // does not meet
          {
            console.log('href')
            continue
          }

          if (has_media) { // need to contain media
            if (ele.media.length <= 0) // does not meet
            {
              console.log('href1')
              continue
            }
          } else { // do not need to contain media
            if (ele.media.length > 0) { // does not meet
              console.log('href2')
              continue
            }
          }

          if (accepted) { // need to contain accepted answer
            if (ele.accepted_answer == null) // does not meet
            {
              console.log('href3')
              continue
            }
          } else { // do not need to contain accepted answer
            if (ele.accepted_answer != null) { // does not meet
              console.log('href4')
              continue
            }
          }

          if (query.length > 0) {
            var regexQuery = new RegExp(query, 'g')
            if (!(regexQuery.test(ele.title) || regexQuery.test(ele.body))) // deoes not meet
            {
              console.log('href5')
              continue
            }
          }

          if (tags.length > 0) {
            console.log('href6')
            if (!(tags.every((val) => ele.tags.includes(val)))) { // does not meet
              console.log('href7')
              continue
            }
          }

          if (count_question < limit) { // add valid question
            var question = {
              id: ele.id,
              user: {
                username: ele.user.username,
                reputation: ele.user.reputation
              },
              title: ele.title,
              body: ele.body,
              score: (ele.upvote.length - ele.downvote.length),
              view_count: ele.viewers.length,
              anwer_count: ele.answers.length,
              timestamp: Math.round((ele.timestamp).getTime() / 1000),
              media: ele.media,
              tags: ele.tags,
              accepted_answer_id: ele.accepted_answer
            }
            console.log('question %s', question)
            return_questions.push(question)
            count_question += 1
          } else { break }
        }
        res.json({ status: 'OK', questions: return_questions })
      } else { res.json({ status: 'error', error: 'without any questions in our db right now' }) }
    }
  })
})

// questions/{id}/upvote ---POST
/*
  * upvates or downvotes the question (in/decrements) score
  return {status: 'OK'}or {status:'error', error:}
  *
*/
app.post('/questions/:id/upvote', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    Question.findOne({ id: req.params.id }).exec(function (err, doc) {
      if (err) {
        res.json({ status: 'error', error: JSON.stringify(err) })
      } else {
        if (doc == null) {
          res.json({ status: 'error', error: 'did not find question with id:  ' + req.params.id })
        } else {
          // find a question
          var upvote = req.body.upvote
          var up_down_arr = doc.upvote
          var field_op = 'upvote'
          if (upvote == false) {
            up_down_arr = doc.downvote
            field_op = 'downvote'
          }
          if (up_down_arr.indexOf(mySession.user.id) > -1) {
            // already upvoted/downvote
            Question.findOne({ id: req.params.id }, { $push: { field_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.json({ status: 'error', error: JSON.stringify(err_1) })
              } else {
                res.json({ status: 'OK' })
              }
            })
          } else {
            Question.findOne({ id: req.params.id }, { $pull: { field_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.json({ status: 'error', error: JSON.stringify(err_1) })
              } else {
                res.json({ status: 'OK' })
              }
            })
          }
        }
      }
    })
  } else {
    res.json({ status: 'error', error: 'you need to login firstly' })
  }
})

// answers/{id}/upvote ---POST
/*
  *
  upvates or downvotes the answers (in/decrements) score
  return {status: 'OK'}or {status:'error', error:}
  *
*/
app.post('/answers/:id/upvote', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    Answer.findOne({ id: req.params.id }).exec(function (err, doc) {
      if (err) {
        res.json({ status: 'error', error: JSON.stringify(err) })
      } else {
        if (doc == null) {
          res.json({ status: 'error', error: 'did not find question with id: ' + req.params.id })
        } else {
          // find a question
          var upvote = req.body.upvote
          var up_down_arr = doc.upvote
          var field_op = 'upvote'
          if (upvote == false) {
            up_down_arr = doc.downvote
            field_op = 'downvote'
          }
          if (up_down_arr.indexOf(mySession.user.id) > -1) {
            // already upvoted/downvote
            Question.findOne({ id: req.params.id }, { $push: { field_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.json({ status: 'error', error: JSON.stringify(err_1) })
              } else {
                res.json({ status: 'OK' })
              }
            })
          } else {
            Question.findOne({ id: req.params.id }, { $pull: { field_op: mySession.user.id } }).populate('user').exec(function (err_1, doc_1) {
              if (err_1) {
                res.json({ status: 'error', error: JSON.stringify(err_1) })
              } else {
                res.json({ status: 'OK' })
              }
            })
          }
        }
      }
    })
  } else {
    res.json({ status: 'error', error: 'you need to login firstly' })
  }
})

// answers/{id}/accepted ---POST
/*
  * accepts an answer
  * if there's accepted answer for the question, it's error
  * should only succeed if logged in user is original asker of associated question
  return {status: 'OK'}or {status:'error', error:}
  *
*/
app.get('/answers/:id/accept', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    Answer.findOne({ id: req.params.id }).populate('user').exec(function (err, doc) {
      if (err) {
        res.json({ status: 'error', error: JSON.stringify(err) })
      } else {
        if (doc == null) {
          res.json({ status: 'error', error: "there's without any asnwer with id: " + req.params.id })
        } else {
          // find the answer
          if (doc.is_accepted) {
            res.json({ status: 'error', error: "there's one accepted answer" })
          }
          // find a question related to the answer
          var question_id = doc.question_id
          Questions.findOne({ id: question_id }).populate('user').exec(function (err_1, doc_1) {
            if (err_1) {
              res.json({ status: 'error', error: JSON.stringify(err_1) })
            }
            if (doc_1.user.username == mySession.username) {
              // orginal asker of the question
              Answer.updateOne({ id: req.params.id }, { $set: { is_accepted: true } })
                .then((doc_2) => {
                  res.json({ status: 'OK' })
                }).catch((err_2) => {
                  res.json({ status: 'error', error: JSON.stringify(err_2) })
                })
            } else {
              res.json({ status: 'error', error: 'you are not the original asker of the question ' })
            }
          })
        }
      }
    })
  } else {
    res.json({ status: 'error', error: 'you need to login firstly' })
  }
})

/** ***************************************** Media **************************************/
// /addmedia ---POST
/*
  * type is multipart/form-data
  * return {status: 'OK', id: id of uploaded media}or {status:'error', error:}
  *
*/
app.post('/addmedia', upload.single('content'), (req, res) => {
  mySession = req.session
  if (mySession.username) {
    if (req.file) {
      console.log('fileame:%s\n', req.file.filename)
      res.json({ status: 'OK', id: req.file.filename })
    } else {
      res.json({ status: 'error', error: 'Error in uploading file' })
    }
  } else {
    res.json({ status: 'error', error: 'Need to login firstly to upload a new file' })
  }
})

// /media/:id---POST
/*
  * type is multipart/form-data
  * return {status: 'OK'}or {status:'error', error:}
  *
*/
app.get('/media/:id', (req, res) => {
  mySession = req.session
  if (mySession.username) {
    var mediaID = req.params.id // filename
    // fs.readFile('mediaID', 'utf8', function(err, data) {
    fs.readFile('mediaID', function (err, data) { // in binary
      if (err) {
        res.json({ status: 'OK', error: JSON.stringify(err) })
      } else {
        res.send(data)
      }
    })
  } else {
    res.json({ status: 'error', error: 'Need to login firstly to get all media files' })
  }
})

/** ************************************ User parts****************************************/
/* Get user profile information for user with {username}
 * return {status: 'OK', user:{ email: string, reputation: int }}} or {status:'error', error:}
 */
app.get('/user/:username', (req, res) => {
  mySession = req.session
  if (mySession.username && (mySession.username == req.params.username)) {
    User.findOne({
      username: req.params.username
    }).then((doc) => {
      if (doc == null) {
        res.json({ status: 'error', error: 'did not find this username: %s\n', doc })
      } else {
        res.json({ status: 'OK', user: { email: doc.email, reputation: doc.reputation } })
      }
    }).catch((err) => {
      res.json({ status: 'error', error: JSON.stringify(err) })
    })
  } else {
    res.json({ status: 'error', error: 'need to log in' })
  }
})

/* Get questions posted by user with {username}
 * return {status: 'OK', questions: '..'}} or {status:'error', error:}
 */
app.get('/user/:username/questions', (req, res) => {
  mySession = req.session
  if (mySession.username && (mySession.username == req.params.username)) {
    Question.find({ user: mySession.user._id }).populate('user').exec(function (err, docs) {
      if (err) {
        res.json({ status: 'error', error: JSON.stringify(err) })
      } else {
        var questions = []
        docs.forEach(function (ele, index) {
          questions.push(ele.id)
        })
        console.log('%s has questions: %s\n', mySession.username, questions)
        res.json({ status: 'OK', questions: questions })
      }
    })
  } else {
    res.json({ status: 'error', error: 'need to log in' })
  }
})

/* Get answers posted by user with {username}
 * return {status: 'OK', questions: '..'}} or {status:'error', error:}
 */
app.get('/user/:username/answers', (req, res) => {
  mySession = req.session
  if (mySession.username && (mySession.username == req.params.username)) {
    Answer.find({ user: mySession.user._id }).populate('user').exec(function (err, docs) {
      if (err) {
        res.json({ status: 'error', error: JSON.stringify(err) })
      } else {
        var answers = []
        docs.forEach(function (ele, index) {
          answers.push(ele.id)
        })
        console.log('%s has answers: %s\n', mySession.username, questions)
        res.json({ status: 'OK', answers: answers })
      }
    })
  } else {
    res.json({ status: 'error', error: 'need to log in' })
  }
})

app.listen(3000, '0.0.0.0', () => console.log('Listening to 30000'))

