const WebSocket = require('ws')
const express = require('express')
const http = require('http')
const path = require('path')

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

// Serve index.html
app.use(express.static(path.join(__dirname)))

const queue = []
const pairs = new Map()

wss.on('connection', (socket) => {
  console.log('A user connected')

  socket.on('message', (data) => {
    const msg = JSON.parse(data)

    if (msg.type === 'join') {
      socket.username = msg.username
      tryMatch(socket)
    }

    if (msg.type === 'typing') {
      const partner = pairs.get(socket)
      if (partner && partner.readyState === WebSocket.OPEN) {
        partner.send(JSON.stringify({ type: 'typing', value: msg.value }))
      }
    }

    if (msg.type === 'message') {
      const partner = pairs.get(socket)
      if (partner && partner.readyState === WebSocket.OPEN) {
        partner.send(JSON.stringify({
          type: 'message',
          text: msg.text,
          from: 'stranger'
        }))
      }
    }

    if (msg.type === 'skip') {
      disconnectUser(socket)
      tryMatch(socket)
    }
  })

  socket.on('close', () => {
    console.log('A user disconnected')
    disconnectUser(socket)
  })
})

function tryMatch(socket) {
  const index = queue.findIndex(s => s !== socket && s.readyState === WebSocket.OPEN)

  if (index !== -1) {
    const partner = queue.splice(index, 1)[0]

    const myIndex = queue.indexOf(socket)
    if (myIndex !== -1) queue.splice(myIndex, 1)

    pairs.set(socket, partner)
    pairs.set(partner, socket)

    socket.send(JSON.stringify({ type: 'matched', partnerName: partner.username }))
    partner.send(JSON.stringify({ type: 'matched', partnerName: socket.username }))

    console.log(`Matched: ${socket.username} <-> ${partner.username}`)
  } else {
    if (!queue.includes(socket)) queue.push(socket)
    socket.send(JSON.stringify({ type: 'waiting' }))
    console.log(`Waiting queue: ${queue.length} user(s)`)
  }
}

function disconnectUser(socket) {
  const partner = pairs.get(socket)

  if (partner && partner.readyState === WebSocket.OPEN) {
    partner.send(JSON.stringify({ type: 'partner_left' }))
    pairs.delete(partner)
  }

  pairs.delete(socket)

  const idx = queue.indexOf(socket)
  if (idx !== -1) queue.splice(idx, 1)
}

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`MSUans server running on port ${PORT}`)
})