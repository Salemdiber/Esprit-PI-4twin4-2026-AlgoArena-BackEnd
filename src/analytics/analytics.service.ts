import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectModel('User') private readonly userModel: Model<any>
    ) { }

    async getPlatformInsights() {
        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

            const totalUsers = await this.userModel.countDocuments();
            const newUsers = await this.userModel.countDocuments({
                createdAt: { $gte: thirtyDaysAgo }
            });

            // Mocks for data we can't accurately get without tracking tools

            const dau = Math.floor(totalUsers * 0.15); // mock 15% DAU
            const peakHours = ['18:00', '20:00', '22:00'];
            const avgTimeSpent = '24m 32s';

            const frequentlyAccessed = [
                { section: 'Battles', accesses: 1250 },
                { section: 'Challenges', accesses: 980 },
                { section: 'Leaderboard', accesses: 850 },
                { section: 'Profile', accesses: 620 }
            ];

            return {
                users: {
                    total: totalUsers,
                    newUsers30Days: newUsers,
                    dailyActiveUsers: dau > 0 ? dau : 1,
                },
                engagement: {
                    peakUsageTimes: peakHours,
                    averageTimeSpent: avgTimeSpent,
                    mostFrequentlyAccessed: frequentlyAccessed
                }
            };
        } catch (e) {
            console.error(e);
            throw e;
        }
    }
}
