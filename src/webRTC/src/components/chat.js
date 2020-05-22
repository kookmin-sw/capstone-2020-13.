import React, { Component } from 'react';
import io from 'socket.io-client'


class Chat extends Component {
    constructor(props) {
        super(props)
        this.state = {
        }
        this.sendMessage = this.sendMessage.bind(this)
        this.sendMessageEnter = this.sendMessageEnter.bind(this)
        // 메세지를 보내주는 주된 함수의 바인딩
    }
    sendMessageEnter() {
        if (window.event.keyCode == 13) {
            const message = document.getElementById('message')

            this.socket.emit('chat', {
                message: message.value
            }, () => {
                console.log(`message : ${message.value}`)
            })
        }
    }
    // enter 키로 sendMessage() 실행 -> 최적화 필요

    sendMessage() {
        const message = document.getElementById('message')

        this.socket.emit('chat', {
            message: message.value
        }, () => {
            console.log(`message : ${message.value}`)
        })

    }
    // server.js와의 통신을 통해 메세지를 보내는 주된 함수


    componentDidMount() {
        this.socket = io.connect(
            //ngrok 서버를 통해 socket 연결이 됨
            this.serviceIP,
            {
                path: '/webrtc',
                query: {}
            }
        )

        this.socket.on('chat', data => {
            console.log('data send')
            const output = document.getElementById('output');
            output.innerHTML += `<p> <strong>` + data.socketID + ': </strong>' + data.message + `</p>`
        })
        //server.js에서 보내주는 데이터를 받아 출력

    }

    render() {
        return (
            <div class="container" id="chat">
                <input id="message" type="text" onKeyDown={this.sendMessageEnter} placeholder="message" />
                <button onClick={this.sendMessage}>Send</button>
                <div id="chat=window">
                    <div id="output"></div>
                </div>
            </div>
        )
    }
    //chat box의 기본 틀
}
export default Chat