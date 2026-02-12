import { Controller, UseGuards, Get } from "@nestjs/common";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Roles } from "src/common/decorators/roles.decorator";
import { UserRole } from "src/database/enums";
import { ReportsService } from "./services/reports.service";

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OPERATOR)
export class ReportsController {
    constructor(private readonly reportsService: ReportsService){}

    @Get('users/statistics')
    async getUserStatistics() {
        return this.reportsService.getUserStatistics();
    }
}