interface User 
{
  id: number,
  name: string,
  nickname: string,
  email: string,
  profileUrl: string,
  need2fa: false,
  is2fa: false,
  isBanned: false,
  status: string,
  following: Array<number>,
  blocking: Array<number>,
}

export default User;