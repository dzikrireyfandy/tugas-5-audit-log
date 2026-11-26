import type { Request, Response } from 'express';
import { AuthService } from '../services/authService.ts';
import { AuditLogService } from '../services/auditLogService.ts';
import { getUser } from '../middlewares/auth.ts';
import { getValidated } from '../middlewares/validate.ts';
import type { LoginInput, RegisterInput } from '../schemas/authSchema.ts';

export class AuthController {
  private authService: AuthService;
  private auditLogService: AuditLogService;

  constructor(
    authService: AuthService = new AuthService(),
    auditLogService: AuditLogService = new AuditLogService(),
  ) {
    this.authService = authService;
    this.auditLogService = auditLogService;
  }

  register = async (_req: Request, res: Response): Promise<void> => {
    const body = getValidated<RegisterInput>(res, 'body');
    const user = await this.authService.register(body);
    res.status(201).json({ status: 'success', data: { user } });
  };

  login = async (req: Request, res: Response): Promise<void> => {
    const body = getValidated<LoginInput>(res, 'body');
    const data = await this.authService.login(body);
    await this.auditLogService.recordLogin(data.user, req);
    res.status(200).json({ status: 'success', data });
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    await this.auditLogService.recordLogout(user, req);
    res.status(200).json({ status: 'success', message: 'Logout berhasil' });
  };

  getMe = async (req: Request, res: Response): Promise<void> => {
    const user = getUser(req);
    res.status(200).json({ status: 'success', data: user });
  };
}
