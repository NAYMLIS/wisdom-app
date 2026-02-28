import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../themes/ThemeContext';
import { userDataService, MeditationSession } from '../services/userDataService';

const MeditationStats = () => {
  const { theme } = useTheme();
  const [stats, setStats] = useState({ sessions: 0, minutes: 0 });
  const [weeklyData, setWeeklyData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const allStats = await userDataService.getStats();
      setStats({ sessions: allStats.totalSessions, minutes: allStats.totalMinutes });

      // Get last 7 days of sessions
      const recentSessions = await userDataService.getRecentSessions(7);

      // Count sessions per day for last 7 days
      const daily = Array(7).fill(0);
      const today = new Date();

      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i));
        const dateISO = date.toISOString().split('T')[0];

        const sessionsOnDay = recentSessions.filter((s) => s.date === dateISO).length;
        daily[i] = sessionsOnDay;
      }

      setWeeklyData(daily);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load stats:', error);
      setLoading(false);
    }
  };

  const maxDaily = Math.max(...weeklyData, 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  if (loading) {
    return <View style={{ height: 120 }} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Summary stats */}
      <View style={styles.summaryRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
            {stats.sessions}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.tertiary }]}>sessions</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
            {Math.round(stats.minutes / 60)}h {stats.minutes % 60}m
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.tertiary }]}>total time</Text>
        </View>
      </View>

      {/* Weekly bars */}
      <View style={styles.chartContainer}>
        <Text style={[styles.chartLabel, { color: theme.colors.secondary }]}>Last 7 days</Text>
        <View style={styles.barChart}>
          {weeklyData.map((count, idx) => {
            const height = maxDaily > 0 ? (count / maxDaily) * 60 : 2;
            return (
              <View key={idx} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(height, 2),
                      backgroundColor:
                        count > 0
                          ? theme.colors.primary
                          : `${theme.colors.border}80`,
                    },
                  ]}
                />
                <Text style={[styles.dayLabel, { color: theme.colors.tertiary }]}>
                  {dayLabels[idx]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 12,
  },
  chartContainer: {
    marginTop: 8,
  },
  chartLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: '60%',
    borderRadius: 4,
    marginBottom: 6,
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
});

export default MeditationStats;
