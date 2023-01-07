const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer')
const schedule = require('node-schedule')

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb', extended: true }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// gửi email
async function sendEmail(email) {
  try {
    let transporter = nodemailer.createTransport({
      host: 'smtp.elasticemail.com',
      port: 2525,
      auth: {
        user: 'todoreminder@outlook.com',
        pass: '91B0D567661C6DFE496E305686B7F29AAFF1',
      },
    })

    let mailStatus = await transporter.sendMail(email)
    console.log(`Message sent to: ${mailStatus.accepted}`)
    return `Message sent to: ${mailStatus.accepted}`
  } catch (error) {
    console.error(error)
    throw new Error(
      `Something went wrong in the sendmail method. Error: ${error.message}`
    )
  }
}

// tạo audio
function createUrl (text, lang) {
	let url = new URL('http://api.voicerss.org/')

	url.searchParams.append('key', 'd4c101ae10e64ca2a65bca79e70c0a60')
	url.searchParams.append('hl', lang)
  url.searchParams.append('s', -10)
  url.searchParams.append('src', text)

	return url.href
}

// lên lịch gửi
function notify (notification) {
    schedule.scheduleJob(notification.email.to, notification.time, () => sendEmail(notification.email))
}

// dừng lịch gửi
function stop (email) {
    schedule.cancelJob(email)
}

app.get('/', (req, res) => {
  res.send('hii');
});

app.post('/', (req, res) => {
  if (req.body.requestType === 'cancel') {
    req.body.emailList.forEach(email => stop(email));
    console.log('received cancel request: ');
    console.log(req.body);
    res.sendStatus(201);
  }
  else if (req.body.requestType === 'send') {
    stop(req.body.email);
  
    const language = req.body.language;
    const todoList = req.body.todoList;
    const learnerType = req.body.learnerType;
    const lastDate = new Date([...todoList].pop().date);
  
    const todayIndex = todoList.map(e => {
      const date = new Date(e.date);
      return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toString();
    }).indexOf(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toString());
  
    const nth = d => {
      if (d > 3 && d < 21) return 'th';
      switch (d % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    }

    let today = (learnerType === 'Auditory' ? 'ngày ' : '') + new Date().getDate() + (learnerType === 'Auditory' ? ' tháng ' : '/') + (new Date().getMonth() + 1);
    if (learnerType === 'Auditory' && language === 'EN') {
      let todayDate = new Date().getDate();
      today = new Date().toLocaleString('en-us', { month: 'long' }) + ' ' + todayDate + nth(todayDate); 
    }

    const messageP1 = language === 'vi-vn' ? 'Lịch của ' + today + ': ' : today + (learnerType === 'Visual' ? '\'s' : '') + ' schedule: ';
    const messageP2 = todoList[todayIndex].tasks.flatMap((e, i) => {
      if (e.name !== 'Nghỉ' && e.name !== '5\'') {
        const interval = e.interval.slice(0, -1);
        return (i === 0 ? '' : learnerType === 'Visual' ? '<br>' : ' ') + interval + (language === 'vi-vn' ? ' tiếng làm ' : (parseFloat(interval) > 1 ? ' hours' : ' hour') + ' of doing ' ) + e.name;
      }
      return [];
    }).join() + (learnerType === 'Auditory' ? '. ' : '<br>') + (language === 'vi-vn' ? 'Hãy chăm chỉ vì một tương lai tốt đẹp đang chờ đợi phía trước!' : 'Let\'s work hard for a bright awaiting future!');
    const message = messageP1 + (learnerType === 'Visual' ? '<br>' : '') + messageP2;

    if (todoList[todayIndex].tasks.length > 0) {
      notify({
        time: {
          tz: 'Asia/Ho_Chi_Minh', 
          rule: '00 00 * * *', // 'phút giờ ngày tháng năm'
          end: new Date(new Date().setDate(lastDate.getDate() + 1)) // thời gian dừng chạy
        },
        email: {
          from: 'todoreminder@outlook.com',
          to: req.body.email,
          subject: language === 'vi-vn' ? 'Thông báo về công việc trong ngày' : 'Notification of today\'s tasks',
          html: learnerType === 'Visual' ? '<p>' + message + '</p>' : '<p></p>',
          attachments: learnerType === 'Auditory' ? [{
            filename: language === 'vi-vn' ? 'nhắc nhở.mp3' : 'reminder.mp3',
            path: createUrl(message, language), // text to speech
          }] : []
        }
      })
    }
  
    console.log('received load: ');
    console.log(req.body);
    res.sendStatus(201);
  }
  else {
    console.log('invalid request');
    res.sendStatus(400);
  }
});

app.listen(PORT, () => console.log('listening on port', PORT));