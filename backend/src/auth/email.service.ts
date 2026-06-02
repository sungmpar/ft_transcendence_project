import * as nodemailer from 'nodemailer';
import Mail = require('nodemailer/lib/mailer');

import { Injectable } from "@nestjs/common";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
	private transporter: Mail;

	constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PW // config : https://support.google.com/accounts/answer/185833?hl=ko
				// nodemailer는 간단한 이메일 전송 테스트만을 위해 작성한 라이브러리이기 때문에 Gmail에서 보안이 낮은 앱으로 판단.. 구글 계정 설정 > Google에 로그인` 메뉴에서 앱 비밀번호를 생성해서 사용
      }
    });
	}

	async sendJoinMail(email: string, token: string)
	{
		const mailOptions: EmailOptions = {
			to: email,
			subject: '가입 인증 메일',
			html: `
				인증코드를 입력하면 가입 인증이 완료됩니다.<br/>
				Code : <b>${token}</b>
			`
		}

		return await this.transporter.sendMail(mailOptions);
	}
}
