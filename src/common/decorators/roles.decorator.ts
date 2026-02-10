import { SetMetadata } from "@nestjs/common";
import { UserRole } from "../../database/enums";

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);