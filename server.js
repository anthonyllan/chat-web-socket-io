const express = require("express");
const cors = require("cors");  // Importar cors
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "http://192.168.0.9:81", // Cambia esto por la URL de tu frontend
    methods: ["GET", "POST"],
    credentials: true
  }
});
const path = require("path");
const mysql = require('mysql2'); // Importar mysql2
const PORT = process.env.PORT || 8000;
const list_users = {};

// Configuración de la base de datos
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1221',
  database: 'csio',
  connectTimeout: 10000 // 10 segundos
});

// Conectar a la base de datos
db.connect((err) => {
  if (err) {
    console.error('Error conectando a la base de datos:', err);
    return;
  }
  console.log('Conectado a la base de datos!');
});

// Middleware para habilitar CORS
app.use(cors({
  origin: "http://192.168.0.9",  // Permite tu dominio
  methods: ["GET", "POST"],      // Métodos permitidos
  credentials: true              // Permitir cookies, sesiones, etc.
}));

// Configurar el directorio de archivos estáticos
app.use(express.static(path.join(__dirname, "views")));

// Cambiar la dirección de escucha del servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(
    "-+-+-+-+- Servidor iniciado -+-+-+-+-+-\n" +
      " -+-+-+- http://0.0.0.0:" +
      PORT +
      " -+-+-+-"
  );
});

// Manejar la conexión de Socket.IO
io.on("connection", (socket) => {
  socket.on("register", (nickname) => {
    if (list_users[nickname]) {
      socket.emit("userExists");
      return;
    } else {
      list_users[nickname] = socket.id;
      socket.nickname = nickname;
      socket.emit("login");

      // Recuperar mensajes anteriores de la base de datos
      const sql = 'SELECT * FROM mensajes ORDER BY fecha ASC'; // Ordenar por fecha
      db.query(sql, (err, results) => {
        if (err) {
          console.error('Error al recuperar mensajes de la base de datos:', err);
          return;
        }

        console.log("Mensajes recuperados:", results); // Verifica los mensajes recuperados

        // Formatear mensajes para enviarlos al cliente
        const formattedMessages = results.map(row => ({
          user: row.usuario,
          message: row.mensaje,
          date: row.fecha // Incluye la fecha si es necesario
        }));

        // Enviar los mensajes al nuevo usuario
        socket.emit("previousMessages", formattedMessages);
      });

      io.emit("activeSessions", list_users);
    }
  });

  socket.on("disconnect", () => {
    delete list_users[socket.nickname];
    io.emit("activeSessions", list_users);
  });

  socket.on("sendMessage", ({ message }) => {
    const user = socket.nickname; // Obtener el apodo del usuario
    const sql = 'INSERT INTO mensajes (usuario, mensaje) VALUES (?, ?)';
    db.query(sql, [user, message], (err, result) => {
      if (err) {
        console.error('Error al guardar el mensaje en la base de datos:', err);
      }
    });

    // Emitir el mensaje al resto de usuarios
    io.emit("sendMessage", { message, user });
  });
});
