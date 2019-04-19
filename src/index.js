const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const {generateMessage, generateLocationMessage} = require('./utils/messages');
const {addUser, removeUser, getUser, getUsersInRoom} = require('./utils/users');


const app = express(); //запускаем экспресс
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public'); // __dirname - папка проекта

//Путь для статичных файлов (css, img итп)
app.use(express.static(publicDirectoryPath));


io.on('connection', (socket) => {
  console.log('New WebSocket connection');

  socket.on('join', (options, callback) => {
    const {error, user} = addUser({id: socket.id, ...options});
console.log(user);
    if (error) {
      return callback(error)
    }

    socket.join(user.room);

    //отправляет сообщение конкретному пользователю
    socket.emit('message', generateMessage('Admin','Welcome!'));
    //отправляет сообщение всем, кроме конкретного пользователя
    socket.broadcast.to(user.room).emit('message', generateMessage('Admin',`${user.username} has joined!'`));

    io.to(user.room).emit('roomData',{
      room:user.room,
      users: getUsersInRoom(user.room)
    });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed')
    }

    io.to(user.room).emit('message', generateMessage(user.username, message)); //отправляет сообщение всем
    callback(`The message was delivered`)
  });

  socket.on('sendLocation', (coords, callback) => {
    const user = getUser(socket.id);
    console.log(user);
    //отправляет сообщение всем
    io.to(user.room).emit('locationMessage', generateLocationMessage(user.username,`https://google.com/maps?q=${coords.latitude},${coords.longitude}`));
    callback();
  });

//отправляет сообщение всем, если кто-то дисконектнулся
  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit('message', generateMessage('Admin',`${user.username} has left!`))
      io.to(user.room).emit('roomData', {
        room:user.room,
        users: getUsersInRoom(user.room)
      })
    }
  })
});


server.listen(port, () => {
  console.log(`Server is up on port ${port}`)
});