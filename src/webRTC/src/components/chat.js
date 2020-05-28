import React, { Component } from 'react';
import io from 'socket.io-client'

class Chat extends Component {
    constructor(props) {
        super(props)
        this.state = {
        }
        this.sendMessage = this.sendMessage.bind(this)
        this.sendMessageEnter = this.sendMessageEnter.bind(this)
        this.chattingLog = this.chattingLog.bind(this)
        // 메세지를 보내주는 주된 함수의 바인딩
    }
    sendMessageEnter() {
        if (window.event.keyCode == 13) {
            var message = document.getElementById('message')

            this.socket.emit('chat', {
                message: message.value
            }, () => {
                console.log(`message : ${message.value}`)
            })
            message.value = ''
        }
    }
    // enter 키로 sendMessage() 실행 -> 최적화 필요

    sendMessage() {
        var message = document.getElementById('message')

        this.socket.emit('chat', {
            message: message.value
        }, () => {
            console.log(`message : ${message.value}`)
        })

        message.value = ''

    }
    // server.js와의 통신을 통해 메세지를 보내는 주된 함수

    chattingLog() {
        this.socket.emit('log')
    }


    componentDidMount() {
        this.socket = io.connect(
            //ngrok 서버를 통해 socket 연결이 됨ㄹㄹ
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
        this.socket.on('log', (data) => {
            console.log(`${data} is JSON`)
            const outputLog = document.getElementById('outputLog')
            alert(data)
        })

    }

    render() {
        return (
            <div class="chatbox2" id="chat">
                <h3> opensource design</h3>
                <div id='scroll' className='chat'>

                    <ui id="output"></ui>
                </div>

                <div className='inputbox'>
                    <input id="message" type="text" className='chatdata' onKeyDown={this.sendMessageEnter} placeholder="message" />
                </div>
                <div className='inputbutton'>
                    <button id="screenshare">화면공유</button>
                    <button id="localvideo">local video</button>
                    <button id="chattinglog" onClick={this.chattingLog}>채팅 로그</button>
                    <div id="outputLog"></div>
                </div>
            </div>
        )
    }

    //
    //chat box의 기본 틀 채팅 입력창 및 컨테이너 수정


}
export default Chat