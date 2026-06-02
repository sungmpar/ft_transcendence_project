import { HttpException, HttpStatus } from "@nestjs/common";
import { existsSync, mkdirSync } from "fs";
import { diskStorage } from 'multer';

export const multerDiskOptions = {
	fileFilter: (req: any, file: any, cb: any) => {
		if (file.mimetype.match(/\/(jpg|jpeg|png)$/)) {
			cb(null, true);
		} else {
			cb(
				new HttpException(
					{
						message: 1,
						error: '지원하지 않는 이미지 형식입니다.',
					},
					HttpStatus.BAD_REQUEST,
				),
				false,
			)
		}
	},

	storage: diskStorage({
		destination: (req: any, file: any, callback: any) => {
			const uploadPath = './profiles';
			if (!existsSync(uploadPath)){
				mkdirSync(uploadPath);
			}
			callback(null, uploadPath);
		},
		filename: (req: any, file: any, callback: any) => {
			const name: string = req.user.name;
			const filename: string = name;
			const ext: string = file.mimetype.split('/')[1];
			console.log(ext);
			callback(null, `${filename}.${ext}`)
		}
	}),

	limits: {
		fieldNameSize: 20,
		fieldSize: 1024*1024,
		fields: 1,
		fileSize: 2097152,
		files: 1,
		}
}
