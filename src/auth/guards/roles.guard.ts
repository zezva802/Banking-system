import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "src/database/enums";


@Injectable()
export class RolesGuard implements CanActivate{
    constructor(private reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
            context.getHandler(),
            context.getClass(),
        ]);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if(!requiredRoles) {
            return true;
        }

        const {user} = context.switchToHttp().getRequest();

        return requiredRoles.some((role) => user.role === role);
    }

}